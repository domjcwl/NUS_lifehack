"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Can I recycle a bubble tea cup?",
  "Greasy pizza box?",
  "Do I need to rinse this can?",
];

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      }).then((r) => r.json());
      setMsgs([...next, { role: "assistant", content: res.reply ?? res.error ?? "No answer." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Could not reach the assistant." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rise pb-28">
      <header>
        <h1 className="text-title">Which bin?</h1>
        <p className="mt-3 text-body leading-relaxed text-[var(--frost-dim)]">
          Hesitation is where recyclables end up in general waste. Ask and go.
        </p>
      </header>

      <div className="mt-2 flex-1 space-y-4">
        {msgs.length === 0 && (
          <div className="space-y-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="press hoverable flex min-h-14 w-full items-center rounded-2xl border border-[var(--edge)] bg-[var(--night-3)]/50 px-4 text-left text-body text-[var(--frost)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-meta ${
              m.role === "user" ? "ml-auto btn-primary" : "card"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="mono text-label text-[var(--aurora-2)]">Thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-2 flex items-center gap-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an item…"
          /* 16px minimum stops iOS zooming the viewport on focus. */
          className="min-h-14 flex-1 rounded-full border border-[var(--edge)] bg-[var(--night-3)]/70 px-4 text-body text-[var(--frost)] outline-none transition-colors placeholder:text-[var(--frost-dim)] focus:border-[var(--aurora-2)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="press grid min-h-14 w-28 place-items-center rounded-full bg-[var(--ice)] text-body font-medium text-[var(--night-0)] disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
