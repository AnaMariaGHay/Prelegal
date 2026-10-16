"use client";

import { useEffect, useRef, useState } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  greeting: string;
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onRetry: () => void;
};

/** Freeform chat with the AI, which works out the document and fills in its fields. */
export function Chat({ greeting, messages, sending, error, onSend, onRetry }: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, error]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    onSend(text);
  }

  const lastIsUnanswered = messages.at(-1)?.role === "user";

  return (
    <section aria-label="Chat with the Prelegal assistant" className="flex h-full min-h-[28rem] flex-col rounded-lg bg-white ring-1 ring-zinc-200">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <Bubble role="assistant" content={greeting} />
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {sending && (
          <p className="text-sm text-zinc-500" role="status">
            Thinking…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
            <p>{error}</p>
            {lastIsUnanswered && !sending && (
              <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
                Try again
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-zinc-200 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Your message
        </label>
        <textarea
          id="chat-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          maxLength={4000}
          placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
          className="flex-1 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="self-end rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function Bubble({ role, content }: ChatMessage) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser ? "bg-sky-700 text-white" : "bg-zinc-100 text-zinc-900"
        }`}
      >
        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
        {content}
      </p>
    </div>
  );
}
