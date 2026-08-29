"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Bin } from "@/lib/bins";

/* Leaflet touches window on import, so it can never render on the server. */
const BinMap = dynamic(() => import("@/components/BinMap"), {
  ssr: false,
  loading: () => <div className="card h-[58vh] min-h-[340px] animate-pulse opacity-60" />,
});

type NearBin = Bin & { metres: number };

export default function Bins() {
  const [near, setNear] = useState<NearBin[] | null>(null);
  const [status, setStatus] = useState("Finding you…");
  const [selected, setSelected] = useState<Bin | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("Location unavailable — pan the map instead.");
      setNear([]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const res = await fetch(
          `/api/bins?lat=${p.coords.latitude}&lng=${p.coords.longitude}&limit=8`,
        ).then((r) => r.json());
        setNear(res.bins ?? []);
        setStatus("Closest to you right now.");
      },
      () => {
        setStatus("Location declined — pan the map instead.");
        setNear([]);
      },
      { timeout: 6000 },
    );
  }, []);

  return (
    <div className="stagger space-y-5">
      <header>
        <p className="mono text-[10px] text-[var(--ink-soft)]">Friction remover</p>
        <h1 className="mt-1 text-[1.6rem] font-semibold">Every bin in Singapore</h1>
        <p className="mt-1.5 text-[0.95rem] text-[var(--ink-soft)]">
          13,006 recycling and e-waste points, straight from NEA. The most common reason
          something recyclable goes in general waste is not knowing where the right bin is.
        </p>
      </header>

      <BinMap onSelect={setSelected} />

      {selected && (
        <section className="card px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mono text-[10px] text-[var(--sea)]">{kindLabel(selected.kind)}</p>
              <p className="mt-1 font-medium">{selected.name}</p>
              {selected.postal && (
                <p className="mono mt-1 text-[10px] text-[var(--ink-soft)]">
                  Singapore {selected.postal}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Dismiss"
              className="press -mr-2 -mt-2 min-h-11 px-3 text-[var(--ink-soft)]"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selected.streams.map((s) => (
              <span
                key={s}
                className="rounded-full bg-[var(--ice-1)] px-2.5 py-1 text-[10px] text-[var(--ink-soft)]"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mono text-[10px] text-[var(--ink-soft)]">{status}</p>
        {near === null ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-20 animate-pulse opacity-50" />
            ))}
          </div>
        ) : near.length === 0 ? null : (
          <ul className="mt-3 space-y-2.5">
            {near.map((b) => (
              <li
                key={b.id}
                className="card press flex items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="mono mt-1 text-[10px] text-[var(--ink-soft)]">
                    {kindLabel(b.kind)}
                    {b.postal ? ` · ${b.postal}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold tabular-nums">{format(b.metres)}</p>
                  <p className="mono text-[9px] text-[var(--ink-soft)]">away</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function kindLabel(k: Bin["kind"]) {
  return k === "recycling" ? "Recycling" : k === "ewaste" ? "E-waste" : "Lamps";
}

function format(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}
