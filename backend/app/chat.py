"""AI chat that works out which document the user needs and drafts it by asking about its fields."""

import json
from datetime import date
from typing import Literal

import anthropic
from pydantic import BaseModel, Field

from app.config import CLAUDE_MODEL
from app.documents import (
    ChatTurn,
    DocumentSpec,
    DocumentState,
    apply_turn,
    fields_at_default,
    load_specs,
    missing_fields,
)

# Shown by the frontend as the first assistant message. It is not sent back as part of
# the history (the API requires the first message to be from the user), so the system
# prompt tells Claude it has already been said.
GREETING = (
    "Hi! I'm Prelegal's assistant. I can draft common business agreements, such as NDAs, "
    "cloud service agreements, data processing agreements and more. What would you like to create?"
)

INSTRUCTIONS = f"""\
You are Prelegal's assistant. You help a user draft a legal agreement by chatting with
them. Every document Prelegal supports is based on a Common Paper standard agreement: a
cover page (called the Cover Page, Order Form or Key Terms), whose fields you fill in
from the conversation, followed by fixed Standard Terms.

The user can see the list of supported documents next to the chat, and once a document is
chosen, a live preview of it that updates as you fill in fields. They have already been
greeted with: "{GREETING}"

## Choosing the document

- Work out which supported document fits what the user needs. If it's clear, set
  `document_type` to its slug and start on its fields. If it isn't clear, ask a short
  question, or suggest the one or two best fits and why.
- If the user asks for a document Prelegal doesn't support (for example an employment
  contract, a lease or a one-way NDA), say plainly that Prelegal can't create that, then
  offer the closest supported document and explain in a sentence how it differs. Only set
  `document_type` once the user agrees.
- If the user wants to switch to a different document later, set `document_type` to the
  new slug. Field values the documents share, and the party details, carry over; check
  that the parties are still in the right roles.

## How to run the conversation

- Ask one or two related questions at a time, in plain, friendly language. Keep each
  reply short: a sentence or two plus your question.
- Start with the parties (company names and which role each plays), then the business
  terms, then governing law and courts, then each party's signatory details: the
  signatory's full name, title, and a notice address (an email or postal address).
- Offer typical choices from the field's help text when they help, e.g. "Most pilots
  last 90 days. Does that work?"
- If the user gives several details at once, take them all.
- Optional fields can stay blank. Mention them briefly once ("there's also an optional
  ... if you need it") rather than asking about each one.
- Some fields start at the template's default value. Confirm them with the user before
  you finish.
- When every required field is filled in, say so, briefly summarize the key terms, and
  tell the user they can review the preview and click Download PDF. Then ask whether they
  want to change anything.
- Answer questions about what the terms mean, using the selected document's Standard
  Terms. You are not a lawyer and do not give legal advice. If asked whether a choice is
  right for their situation, explain the trade-off and suggest they check with a lawyer
  for anything high stakes.

## Filling in fields

Return changes in `field_updates` (by field key) and `party_updates`:
- Include only values the user has stated or clearly confirmed. Never invent names,
  titles, addresses, dates or amounts.
- Use the current values in the latest system note to avoid re-asking for fields that are
  already filled in. Update a field again if the user corrects it.
- Dates are ISO format (YYYY-MM-DD). Resolve words like "today" or "the first of next
  month" using today's date from the system note.
- Party 1 is the document's first party role and party 2 its second, e.g. for a Cloud
  Service Agreement party 1 is the Provider and party 2 the Customer.
- Write values so they read well where they appear on the cover page, following the
  field's help text.
- Use plain text in `reply`, with no Markdown.

## Supported documents

"""


def describe_spec(spec: DocumentSpec) -> str:
    lines = [
        f"### {spec.name} (slug: {spec.slug})",
        spec.summary,
        f"Parties: party 1 is {spec.parties[0]}, party 2 is {spec.parties[1]}. Cover page title: {spec.cover_title}.",
        "Fields:",
    ]
    for f in spec.fields:
        notes = [f.type] + (["optional"] if f.optional else []) + ([f"default: {f.default}"] if f.default else [])
        lines.append(f"- {f.key}: {f.label} ({', '.join(notes)}). {f.help}")
    return "\n".join(lines)


def catalog_prompt() -> str:
    return INSTRUCTIONS + "\n\n".join(describe_spec(s) for s in load_specs().values())


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    document: DocumentState


class ChatResponse(BaseModel):
    reply: str
    document: DocumentState


class ChatError(Exception):
    """A chat turn failed in a way the user should be told about."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def build_system(spec: DocumentSpec | None, standard_terms: str | None) -> list[dict]:
    # The instructions and document catalog never change, so they are cached first. The
    # selected document's Standard Terms only change if the user switches documents, so
    # they get their own cache breakpoint.
    system = [{"type": "text", "text": catalog_prompt(), "cache_control": {"type": "ephemeral"}}]
    if spec is not None and standard_terms:
        system.append(
            {
                "type": "text",
                "text": f"## Standard Terms of the selected document: {spec.name}\n\n{standard_terms}",
                "cache_control": {"type": "ephemeral"},
            }
        )
    return system


def state_note(document: DocumentState, spec: DocumentSpec | None, today: date) -> str:
    lines = [f"Today's date is {today:%A, %B} {today.day}, {today.year} ({today.isoformat()}). Use it for 'today'."]
    if spec is None:
        lines.append("No document has been chosen yet.")
        return "\n".join(lines)

    missing = missing_fields(document, spec)
    defaults = fields_at_default(document, spec)
    parties = {
        f"party {i} ({role})": party.model_dump(by_alias=True)
        for i, (role, party) in enumerate(zip(spec.parties, document.parties), start=1)
    }
    lines += [
        f"Selected document: {spec.name} (slug: {spec.slug}).",
        f"Current field values (JSON): {json.dumps(document.fields, ensure_ascii=False)}",
        f"Current parties (JSON): {json.dumps(parties, ensure_ascii=False)}",
        f"Still missing: {', '.join(missing) if missing else 'nothing, every required field is filled in'}.",
    ]
    if defaults:
        lines.append(f"Still at the template default (confirm with the user): {', '.join(defaults)}.")
    return "\n".join(lines)


def build_messages(request: ChatRequest, spec: DocumentSpec | None, today: date) -> list[dict]:
    messages: list[dict] = [{"role": m.role, "content": m.content} for m in request.messages]
    # A cache breakpoint on the latest user message, so next turn's request (which repeats
    # this history) reads the conversation so far from the cache.
    last = messages[-1]
    last["content"] = [{"type": "text", "text": last["content"], "cache_control": {"type": "ephemeral"}}]
    # Volatile per-turn state goes last, after the cached prefix, as a mid-conversation
    # system message. It is never stored in the history.
    messages.append({"role": "system", "content": state_note(request.document, spec, today)})
    return messages


async def run_chat_turn(
    client: anthropic.AsyncAnthropic, request: ChatRequest, standard_terms: str | None, today: date
) -> ChatResponse:
    if request.messages[-1].role != "user":
        raise ChatError("The last message must be from the user.", status_code=422)
    spec = load_specs().get(request.document.type) if request.document.type else None

    try:
        response = await client.beta.messages.parse(
            model=CLAUDE_MODEL,
            max_tokens=16000,
            output_config={"effort": "low"},  # short conversational turns
            # On a safety-classifier refusal, retry on Anthropic's recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=build_system(spec, standard_terms),
            messages=build_messages(request, spec, today),
            output_format=ChatTurn,
        )
    except anthropic.AuthenticationError as e:
        raise ChatError("The AI service rejected the API key. Check ANTHROPIC_API_KEY in backend/.env.", 503) from e
    except anthropic.RateLimitError as e:
        raise ChatError("The AI service is busy right now. Please try again in a moment.", 503) from e
    except anthropic.APIStatusError as e:
        raise ChatError(f"The AI service returned an error ({e.status_code}). Please try again.") from e
    except anthropic.APIConnectionError as e:
        raise ChatError("Couldn't reach the AI service. Check your internet connection and try again.") from e

    if response.stop_reason == "refusal":
        raise ChatError("Sorry, I can't help with that request. Let's continue with your document.", 422)
    turn = response.parsed_output
    if turn is None:
        raise ChatError("The AI's response was incomplete. Please try again.")

    return ChatResponse(reply=turn.reply.strip(), document=apply_turn(request.document, turn))
