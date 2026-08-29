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
    <div className="flex flex-col gap-4 rise pb-20">
      <header>
        <p className="mono text-[10px] text-[var(--frost-dim)]">At the point of decision</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Which bin?</h1>
        <p className="mt-2 text-sm text-[var(--frost-dim)]">
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
                className="press hoverable min-h-11 rounded-full border border-[var(--edge)] bg-[var(--night-3)]/50 px-4 text-[0.85rem]"
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
                ? "ml-auto btn-primary "
                : "card"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="mono text-[10px] text-[var(--aurora-2)]">Thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed inset-x-0 z-20 mx-auto flex max-w-lg gap-2 px-4"
        style={{ bottom: "calc(var(--tabbar-h) + var(--safe-b) + 0.75rem)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an item…"
          /* 16px minimum stops iOS zooming the viewport on focus. */
          className="min-h-14 flex-1 rounded-full border border-[var(--edge)] bg-[var(--night-3)]/70 px-5 text-base outline-none backdrop-blur transition-colors focus:border-[var(--aurora-2)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="press min-h-14 shrink-0 rounded-full btn-primary px-6 text-[0.95rem] font-medium   disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
