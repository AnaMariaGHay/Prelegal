"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/lib/ui";

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
    <section aria-label="Chat with the Prelegal assistant" className={`${ui.card} flex h-full min-h-[24rem] flex-col`}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <Bubble role="assistant" content={greeting} />
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {sending && (
          <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
            <span className="flex gap-1" aria-hidden>
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" />
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
            </span>
            Thinking…
          </p>
        )}
        {error && (
          <div role="alert" className={ui.errorBox}>
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
          className={`${ui.input} flex-1 resize-none`}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className={`${ui.primaryButton} self-end`}
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
