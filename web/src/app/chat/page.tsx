"use client";

import { useCallback, useRef, useState } from "react";

import type { ChatMessage, ChatReply, Coords } from "@/lib/chatbot";

/* A user turn is just text. An assistant turn carries everything the knowledge
   service returned with it — the sources it drew on, the bins it found, and
   whether it was actually grounded — because those are what make the answer
   checkable rather than something to be taken on faith. */
type Turn = { role: "user"; content: string } | ({ role: "assistant" } & ChatReply);

const SUGGESTIONS = [
  "Can I recycle a bubble tea cup?",
  "Greasy pizza box?",
  "Where can I drop off an old laptop?",
];

export default function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  /* Held for the session once granted, so a follow-up question does not fire a
     second permission prompt at someone standing in a corridor. */
  const coords = useRef<Coords | null>(null);

  const send = useCallback(
    async (text: string, history?: Turn[]) => {
      if (!text.trim() || busy) return;
      const next: Turn[] = [...(history ?? turns), { role: "user", content: text }];
      setTurns(next);
      setInput("");
      setBusy(true);
      try {
        const res: ChatReply = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          /* The whole session goes up every time — the service is stateless and
             resolves "which one is closest?" against what was said before it. */
          body: JSON.stringify({ messages: toMessages(next), location: coords.current }),
        }).then((r) => r.json());
        setTurns([...next, { ...res, role: "assistant" }]);
      } catch {
        setTurns([
          ...next,
          { ...EMPTY_REPLY, role: "assistant", answer: "Could not reach the assistant." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, turns],
  );

  /* The service asked for coordinates. Get them, remember them, and re-ask the
     question the user already typed — making them type it twice is the kind of
     small betrayal that ends a demo. */
  const shareLocation = useCallback(() => {
    let lastAsk = -1;
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "user") {
        lastAsk = i;
        break;
      }
    }
    const question = lastAsk < 0 ? null : (turns[lastAsk] as { content: string }).content;
    if (!question || !navigator.geolocation) return;
    /* Everything before the question — the question itself is re-sent, and the
       answer that asked for a location is dropped. */
    const history = turns.slice(0, lastAsk);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        coords.current = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setBusy(false);
        void send(question, history);
      },
      () => {
        setBusy(false);
        setTurns((cur) => [
          ...cur,
          {
            ...EMPTY_REPLY,
            role: "assistant",
            answer:
              "No location, no problem — tell me a postal code or a place name " +
              "(try “I'm at Raffles Hall”) and I'll find the nearest bin.",
          },
        ]);
      },
      { timeout: 6000 },
    );
  }, [turns, send]);

  /* Start over. Everything the next answer could be built from goes: the turns,
     the half-typed message, and the coordinates — someone starting a new session
     may well have walked somewhere else, and a silently reused position would
     send them to a bin that was nearest ten minutes ago. */
  const newSession = useCallback(() => {
    if (busy) return;
    setTurns([]);
    setInput("");
    coords.current = null;
  }, [busy]);

  return (
    <div className="rise flex flex-col gap-4 pb-28">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-title">Which bin?</h1>
          {turns.length > 0 && (
            <button
              onClick={newSession}
              disabled={busy}
              /* Top-right, deliberately far from the send button at the bottom —
                 a thumb reaching to ask should never land on "erase". */
              className="press hoverable -mr-2 mt-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[var(--edge)] px-4 text-meta text-[var(--frost-dim)] disabled:opacity-40"
            >
              <RefreshIcon />
              New chat
            </button>
          )}
        </div>
        <p className="mt-3 text-body leading-relaxed text-[var(--frost-dim)]">
          Hesitation is where recyclables end up in general waste. Ask and go.
        </p>
      </header>

      <div className="mt-2 flex-1 space-y-4">
        {turns.length === 0 && (
          <div className="space-y-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="press hoverable flex min-h-14 w-full items-center rounded-[1.7rem] border border-[var(--edge)] bg-[var(--night-3)]/50 px-4 text-left text-body text-[var(--frost)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div
              key={i}
              className="btn-primary ml-auto max-w-[85%] rounded-2xl px-4 py-2.5 text-meta"
            >
              {t.content}
            </div>
          ) : (
            <Answer key={i} reply={t} onShareLocation={shareLocation} />
          ),
        )}
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

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function Answer({ reply, onShareLocation }: { reply: ChatReply; onShareLocation: () => void }) {
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="max-w-[92%] space-y-2.5">
      <div className="card rounded-2xl px-4 py-2.5 text-meta">{reply.answer}</div>

      {/* An answer with nothing behind it has to look different from one that was
          checked. This is the only signal the user gets. */}
      {!reply.grounded && reply.answer && (
        <p className="mono text-label text-[var(--gold)]">
          Not backed by a source — treat as a guess.
        </p>
      )}

      {reply.needs_location && (
        <button
          onClick={onShareLocation}
          className="press hoverable inline-flex min-h-14 items-center rounded-full border border-[var(--edge)] px-6 text-body text-[var(--frost)]"
        >
          Use my location
        </button>
      )}

      {/* Where we think they are. Shown because a wrong guess is invisible
          otherwise — the bins below would just be three plausible wrong bins. */}
      {reply.resolved_location && (
        <p className="mono text-label text-[var(--frost-dim)]">
          Near {reply.resolved_location.name}
        </p>
      )}

      {reply.locations.length > 0 && (
        <ul className="space-y-2">
          {reply.locations.map((b, i) => (
            <li key={`${b.postal}-${b.latitude}-${b.longitude}-${i}`}>
              <a
                href={b.directions_url}
                target="_blank"
                rel="noreferrer"
                className="card press hoverable pad-tight flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-meta font-medium">{b.name}</p>
                  <p className="mono mt-0.5 text-label text-[var(--frost-dim)]">
                    {b.kind === "recycling" ? "Recycling" : "E-waste"}
                    {b.postal ? ` · ${b.postal}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-meta font-semibold tabular-nums">{distance(b.metres)}</p>
                  <p className="mono text-label text-[var(--aurora-2)]">Directions</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {reply.sources.length > 0 && (
        <div>
          <button
            onClick={() => setShowSources((s) => !s)}
            aria-expanded={showSources}
            className="press mono min-h-11 text-label text-[var(--frost-dim)]"
          >
            {showSources ? "Hide sources" : `Sources · ${reply.sources.length}`}
          </button>
          {showSources && (
            <ul className="mt-1 space-y-2">
              {reply.sources.map((s) => (
                <li key={s.id} className="card pad-tight">
                  <p className="text-micro leading-relaxed text-[var(--frost-dim)]">{s.snippet}</p>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mono mt-1.5 inline-block text-label text-[var(--aurora-2)] underline-offset-2 hover:underline"
                  >
                    {/* `quoted` false means the snippet is our summary of public
                        guidance, not NEA's words. Labelling it as a quotation
                        would be a citation the source does not support. */}
                    {s.quoted ? s.title : `Further reading — ${s.title}`}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reply.notes.map((n) => (
        <p key={n} className="mono text-label text-[var(--frost-faint)]">
          {n}
        </p>
      ))}
    </div>
  );
}

/** The service takes the conversation, not one message — "what about the
 *  charger?" cannot be answered without the turns before it.
 *
 *  Capped at the newest 40 because that is the service's own limit; over it the
 *  request is rejected and the app quietly falls back to an ungrounded answer,
 *  which is the worst way to hit a limit. Taking the tail keeps the last message
 *  a user one, which the service also requires. */
function toMessages(turns: Turn[]): ChatMessage[] {
  return turns
    .map((t) => ({
      role: t.role,
      content: (t.role === "user" ? t.content : t.answer).trim(),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-40);
}

function distance(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

const EMPTY_REPLY: ChatReply = {
  answer: "",
  intent: "unknown",
  sources: [],
  locations: [],
  resolved_location: null,
  needs_location: false,
  grounded: false,
  used_model: false,
  notes: [],
};
