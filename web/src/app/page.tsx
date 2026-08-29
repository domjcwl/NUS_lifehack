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

  useEffect(() => {
    fetch("/api/log").then((r) => r.json()).then(setS);
  }, []);

  async function simulateScan() {
    const res = await fetch("/api/log", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ binId: "com3-l1" }),
    });
    const inst = await res.json();
    setScanUrl(`/scan/${inst.id}`);
  }

  if (!s) return <p className="mono text-xs text-[var(--ink-soft)]">Loading…</p>;

  const copy = BEAR_COPY[s.mood];

  return (
    <div className="space-y-6 rise">
      <section className="card flex flex-col items-center px-5 py-6 text-center">
        <Bear mood={s.mood} health={s.health} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 max-w-xs text-sm text-[var(--ink-soft)]">{copy.line}</p>

        <div className="mt-5 flex w-full gap-3">
          <Stat label="Day streak" value={String(s.streak)} accent />
          <Stat label="Verified" value={String(s.total)} />
          <Stat label="Ice" value={`${s.health}%`} />
        </div>
      </section>

      <section className="card px-5 py-5">
        <p className="mono text-[10px] text-[var(--ink-soft)]">At the bin</p>
        <h2 className="mt-1 text-lg font-semibold">Scan, shoot, done.</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Every recycling point has a code. Scanning it opens a one-time slot that only
          your photo can fill — which is what makes the count mean something.
        </p>

        {scanUrl ? (
          <Link
            href={scanUrl}
            className="mt-4 block rounded-full bg-[var(--deep)] px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--sea)]"
          >
            Open the scan →
          </Link>
        ) : (
          <button
            onClick={simulateScan}
            className="mt-4 w-full rounded-full bg-[var(--deep)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--sea)]"
          >
            Scan the code at COM3 Level 1
          </button>
        )}
        <p className="mt-2 text-center text-[10px] mono text-[var(--ink-soft)]">
          Demo: this button stands in for the camera scanning a printed QR.
        </p>
      </section>

      {s.recent.length > 0 && (
        <section className="card px-5 py-5">
          <p className="mono text-[10px] text-[var(--ink-soft)]">Recent</p>
          <ul className="mt-3 space-y-2.5">
            {s.recent.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="capitalize">{a.item}</span>
                <span className="mono text-[10px] text-[var(--ink-soft)]">
                  {new Date(a.at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl border border-[var(--edge)] bg-white/60 px-3 py-3">
      <p className={`text-2xl font-semibold ${accent ? "text-[var(--coral)]" : ""}`}>{value}</p>
      <p className="mono mt-0.5 text-[9px] text-[var(--ink-soft)]">{label}</p>
    </div>
  );
}
