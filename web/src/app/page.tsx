"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Bear from "@/components/Bear";
import { BEAR_COPY } from "@/lib/bear";
import type { Action, BearMood } from "@/lib/types";

interface State {
  streak: number;
  level: number;
  xp: number;
  levelProgress: number;
  stage: string;
  mood: BearMood;
  health: number;
  total: number;
  lastActionAt: number | null;
  recent: Action[];
}

export default function Home() {
  const [s, setS] = useState<State | null>(null);
  const [fromHealth, setFromHealth] = useState<number | undefined>(undefined);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    const stashed = sessionStorage.getItem("floe:fromHealth");
    if (stashed !== null) {
      setFromHealth(Number(stashed));
      sessionStorage.removeItem("floe:fromHealth");
    }
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
        <div className="card card-lg h-80 animate-pulse opacity-50" />
        <div className="card h-24 animate-pulse opacity-30" />
      </div>
    );
  }

  const copy = BEAR_COPY[s.mood];

  return (
    <>
      <div className="stagger space-y-4">
        <section className="card card-lg overflow-hidden">
          <Bear mood={s.mood} health={s.health} fromHealth={fromHealth} level={s.level} />

          <div className="pad">
            {/* The display face earns its keep at this size, not at 14px. */}
            <h1 className="mt-2 text-title">{copy.title}</h1>
            <p className="mt-2.5 max-w-[26ch] text-body text-[var(--frost-dim)]">
              {copy.line}
            </p>

            {/* Points buy growth, so the bar sits under the animal it grows. */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-body">
                  <span className="capitalize">{s.stage}</span>
                  <span className="text-[var(--frost-faint)]"> · level {s.level}</span>
                </p>
                <p className="tnum text-meta text-[var(--frost-faint)]">{s.xp} XP</p>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--night-3)]"
                role="progressbar"
                aria-valuenow={Math.round(s.levelProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress to level ${s.level + 1}`}
              >
                <div
                  className="h-full rounded-full bg-[var(--aurora-1)] transition-[width] duration-500"
                  style={{ width: `${Math.max(3, s.levelProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-[var(--edge)]">
            <Stat label="Streak" value={pad(s.streak)} unit="days" accent />
            <Stat label="Verified" value={pad(s.total)} unit="actions" divider />
            <Stat label="Ice" value={`${s.health}`} unit="percent" divider />
          </div>
        </section>

        <section className="card pad">
          <h2 className="text-head">Scan, shoot, done.</h2>
          <p className="mt-2 text-body text-[var(--frost-dim)]">
            Every blue bin has a code on it. Scanning opens a one-time slot that only your
            photo can fill — which is what makes the count mean something.
          </p>
        </section>

        {s.recent.length > 0 && (
          <section className="card pad">
            <h2 className="text-body text-[var(--frost-dim)]">Recent</h2>
            <ul className="mt-3.5 divide-y divide-[var(--edge)]">
              {s.recent.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="capitalize">{a.item}</span>
                  <span className="mono tnum shrink-0 text-label text-[var(--frost-faint)]">
                    {new Date(a.at).toLocaleDateString("en-SG", { day: "2-digit", month: "short" })}
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
        className="fixed inset-x-0 z-30 px-4"
        style={{ bottom: "calc(var(--tabbar-h) + var(--safe-b) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-lg">
          {scanUrl ? (
            <Link
              href={scanUrl}
              className="press btn-primary flex min-h-14 items-center justify-center rounded-full px-6 text-body"
            >
              Open the scan →
            </Link>
          ) : (
            <button
              onClick={simulateScan}
              disabled={minting}
              className="press btn-primary flex min-h-14 w-full items-center justify-center rounded-full px-6 text-body disabled:opacity-60"
            >
              {minting ? "Opening…" : "Scan the code at Blk 826A"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function Stat({
  label,
  value,
  unit,
  accent,
  divider,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  divider?: boolean;
}) {
  return (
    <div className={`pad-tight ${divider ? "border-l border-[var(--edge)]" : ""}`}>
      <p
        className={`tnum text-title leading-none font-bold ${
          accent ? "text-[var(--coral)]" : "text-[var(--frost)]"
        }`}
      >
        {value}
      </p>
      <p className="mono mt-1.5 text-label text-[var(--frost-faint)]">{label}</p>
      <p className="mt-0.5 text-micro text-[var(--frost-faint)]">{unit}</p>
    </div>
  );
}
