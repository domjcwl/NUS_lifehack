"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Bear from "@/components/Bear";
import { BEAR_COPY } from "@/lib/bear";
import type { Action, BearMood } from "@/lib/types";

interface State {
  streak: number;
  mood: BearMood;
  health: number;
  total: number;
  lastActionAt: number | null;
  recent: Action[];
}

export default function Home() {
  const [s, setS] = useState<State | null>(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    fetch("/api/log").then((r) => r.json()).then(setS);
  }, []);

  async function simulateScan() {
    setMinting(true);
    try {
      const inst = await fetch("/api/log", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ binId: "tpe-826a" }),
      }).then((r) => r.json());
      setScanUrl(`/scan/${inst.id}`);
    } finally {
      setMinting(false);
    }
  }

  if (!s) {
    return (
      <div className="space-y-4">
        <div className="card card-lg h-64 animate-pulse opacity-60" />
        <div className="card h-28 animate-pulse opacity-40" />
      </div>
    );
  }

  const copy = BEAR_COPY[s.mood];

  return (
    <>
      <div className="stagger space-y-4">
        <section className="card card-lg flex flex-col items-center px-5 pb-6 pt-5 text-center">
          <Bear mood={s.mood} health={s.health} />
          <h1 className="mt-3 text-[1.65rem] font-semibold">{copy.title}</h1>
          <p className="mt-1 max-w-xs text-[0.95rem] text-[var(--ink-soft)]">{copy.line}</p>

          <div className="mt-5 flex w-full gap-2.5">
            <Stat label="Day streak" value={String(s.streak)} accent />
            <Stat label="Verified" value={String(s.total)} />
            <Stat label="Ice" value={`${s.health}%`} />
          </div>
        </section>

        <section className="card px-5 py-5">
          <p className="mono text-[10px] text-[var(--ink-soft)]">At the bin</p>
          <h2 className="mt-1 text-lg font-semibold">Scan, shoot, done.</h2>
          <p className="mt-1.5 text-[0.95rem] text-[var(--ink-soft)]">
            Every blue bin has a code on it. Scanning opens a one-time slot that only your
            photo can fill — which is what makes the count mean something.
          </p>
        </section>

        {s.recent.length > 0 && (
          <section className="card px-5 py-5">
            <p className="mono text-[10px] text-[var(--ink-soft)]">Recent</p>
            <ul className="mt-3 space-y-3">
              {s.recent.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3">
                  <span className="capitalize">{a.item}</span>
                  <span className="mono shrink-0 text-[10px] text-[var(--ink-soft)]">
                    {new Date(a.at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/*
        The primary action lives in the thumb zone, not mid-screen. This is the
        one thing a user opens the app to do.
      */}
      <div
        className="fixed inset-x-0 z-20 px-4"
        style={{ bottom: "calc(var(--tabbar-h) + var(--safe-b) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-lg">
          {scanUrl ? (
            <Link
              href={scanUrl}
              className="press flex min-h-14 items-center justify-center rounded-full bg-[var(--deep)] px-6 text-[0.95rem] font-medium text-white shadow-lg shadow-[var(--deep)]/25"
            >
              Open the scan →
            </Link>
          ) : (
            <button
              onClick={simulateScan}
              disabled={minting}
              className="press flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--deep)] px-6 text-[0.95rem] font-medium text-white shadow-lg shadow-[var(--deep)]/25 disabled:opacity-60"
            >
              {minting ? "Opening…" : "Scan the code at Blk 826A"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl border border-[var(--edge)] bg-white/60 px-2.5 py-3">
      <p className={`text-[1.7rem] font-semibold tabular-nums ${accent ? "text-[var(--coral)]" : ""}`}>
        {value}
      </p>
      <p className="mono mt-0.5 text-[9px] leading-tight text-[var(--ink-soft)]">{label}</p>
    </div>
  );
}
