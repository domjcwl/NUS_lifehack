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
    <div className="flex min-h-[70vh] flex-col gap-4 rise">
      <header>
        <p className="mono text-[10px] text-[var(--ink-soft)]">At the point of decision</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Which bin?</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Hesitation is where recyclables end up in general waste. Ask and go.
        </p>
      </header>

      <div className="flex-1 space-y-3">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-[var(--edge)] bg-white/60 px-3 py-1.5 text-xs transition hover:bg-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "user"
                ? "ml-auto bg-[var(--deep)] text-white"
                : "card"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="mono text-[10px] text-[var(--sea)]">Thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an item…"
          className="flex-1 rounded-full border border-[var(--edge)] bg-white/80 px-4 py-3 text-sm outline-none focus:border-[var(--sea)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--deep)] px-5 text-sm font-medium text-white disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
