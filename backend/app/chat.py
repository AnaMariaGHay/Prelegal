"""AI chat that drafts a Mutual NDA by asking the user about its cover page fields."""

from datetime import date
from typing import Literal

import anthropic
from pydantic import BaseModel, Field

from app.config import CLAUDE_MODEL
from app.nda import ChatTurn, NdaDocument, apply_update, missing_fields

# Shown by the frontend as the first assistant message. It is not sent back as part of
# the history (the API requires the first message to be from the user), so the system
# prompt tells Claude it has already been said.
GREETING = (
    "Hi! I'll help you put together a Mutual Non-Disclosure Agreement. "
    "To start, who are the two parties? Just the company names is fine for now."
)

INSTRUCTIONS = f"""\
You are Prelegal's assistant. You help a user complete a Mutual Non-Disclosure Agreement
(MNDA) based on the Common Paper Mutual NDA (Version 1.0) by chatting with them. The
document has a Cover Page, whose fields you fill in from the conversation, and fixed
Standard Terms, which are included below for reference.

The user can see a live preview of the document next to the chat, and it updates as you
fill in fields. They have already been greeted with: "{GREETING}"

## Cover Page fields

- Purpose: how Confidential Information may be used. The template's suggested default is
  "Evaluating whether to enter into a business relationship with the other party."
- Effective Date: the date the MNDA starts.
- MNDA Term: either expires a whole number of years after the Effective Date, or
  continues until terminated.
- Term of Confidentiality: either a whole number of years after the Effective Date (trade
  secrets stay protected for as long as they remain trade secrets), or in perpetuity.
- Governing Law: the US state whose laws govern the MNDA.
- Jurisdiction: the city or county and state whose courts hear disputes, e.g.
  "New Castle, DE".
- MNDA Modifications: optional changes to the Standard Terms. Leave it empty unless the
  user asks for a change.
- For each of Party 1 and Party 2: company, the signatory's full name, the signatory's
  title, and a notice address (an email or postal address).

## How to run the conversation

- Ask one or two related questions at a time, in plain, friendly language. Keep each
  reply short: a sentence or two plus your question.
- Work through the missing fields in a natural order: the parties first, then the
  purpose, dates and terms, then governing law and jurisdiction, then each party's
  signatory details.
- Offer the template's typical choices when they help, e.g. "Most MNDAs last 1 year.
  Does that work, or would you like longer?"
- If the user gives several details at once, take them all.
- The MNDA Term and Term of Confidentiality start at the template defaults (1 year each),
  so they never show as missing. Confirm both with the user before you finish.
- When every required field is filled in, say so, briefly summarize the key terms, and
  tell the user they can review the preview and click Download PDF. Then ask whether they
  want to change anything.
- Answer questions about what the terms mean, using the Standard Terms below. You are not
  a lawyer and do not give legal advice. If asked whether a choice is right for their
  situation, explain the trade-off and suggest they check with a lawyer for anything high
  stakes.
- Prelegal can only create this Mutual NDA for now. If the user asks for a different
  kind of document, say that politely and offer to continue with the MNDA.

## Filling in fields

Return the fields to change in `updates`:
- Include only fields the user has stated or clearly confirmed. Never invent names,
  titles, addresses or dates. Leave everything else null, which means unchanged.
- Use the current values in the latest system note to avoid re-asking for fields that are
  already filled in. Update a field again if the user corrects it.
- Dates are ISO format (YYYY-MM-DD). Resolve words like "today" or "the first of next
  month" using today's date from the system note.
- Party 1 is the first company the user names, unless they say otherwise.
- Write governing law as just the state name (e.g. "Delaware") and jurisdiction as the
  place (e.g. "New Castle, DE"), because the document adds its own wording around them.
- Use plain text in `reply`, with no Markdown.

## Standard Terms (for reference)

"""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    document: NdaDocument


class ChatResponse(BaseModel):
    reply: str
    document: NdaDocument


class ChatError(Exception):
    """A chat turn failed in a way the user should be told about."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def build_system(standard_terms: str) -> list[dict]:
    # Stable across every request, so it is cached (first breakpoint).
    return [{"type": "text", "text": INSTRUCTIONS + standard_terms, "cache_control": {"type": "ephemeral"}}]


def build_messages(request: ChatRequest, today: date) -> list[dict]:
    messages: list[dict] = [{"role": m.role, "content": m.content} for m in request.messages]
    # Second breakpoint on the latest user message, so next turn's request (which repeats
    # this history) reads the conversation so far from the cache.
    last = messages[-1]
    last["content"] = [{"type": "text", "text": last["content"], "cache_control": {"type": "ephemeral"}}]

    missing = missing_fields(request.document)
    note = (
        f"Today's date is {today.isoformat()}.\n"
        f"Current document fields (JSON): {request.document.model_dump_json(by_alias=True)}\n"
        f"Still missing: {', '.join(missing) if missing else 'nothing, every required field is filled in'}."
    )
    # Volatile per-turn state goes last, after the cached prefix, as a mid-conversation
    # system message. It is never stored in the history.
    messages.append({"role": "system", "content": note})
    return messages


async def run_chat_turn(
    client: anthropic.AsyncAnthropic, request: ChatRequest, standard_terms: str, today: date
) -> ChatResponse:
    if request.messages[-1].role != "user":
        raise ChatError("The last message must be from the user.", status_code=422)

    try:
        response = await client.beta.messages.parse(
            model=CLAUDE_MODEL,
            max_tokens=16000,
            output_config={"effort": "low"},  # short conversational turns
            # On a safety-classifier refusal, retry on Anthropic's recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=build_system(standard_terms),
            messages=build_messages(request, today),
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
        raise ChatError("Sorry, I can't help with that request. Let's continue with the NDA.", 422)
    turn = response.parsed_output
    if turn is None:
        raise ChatError("The AI's response was incomplete. Please try again.")

    return ChatResponse(reply=turn.reply.strip(), document=apply_update(request.document, turn.updates))
