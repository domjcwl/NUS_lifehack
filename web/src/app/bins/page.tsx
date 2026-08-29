"use client";

import Link from "next/link";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Bin, BinKind } from "@/lib/bins";

/* Leaflet touches window on import, so it can never render on the server. */
const BinMap = dynamic(() => import("@/components/BinMap"), {
  ssr: false,
  loading: () => <div className="card h-[58vh] min-h-[340px] animate-pulse opacity-60" />,
});

type NearBin = Bin & { metres: number };

const ALL_KINDS: BinKind[] = ["recycling", "ewaste"];

export default function Bins() {
  const [kinds, setKinds] = useState<BinKind[]>(ALL_KINDS);
  const [near, setNear] = useState<NearBin[] | null>(null);
  const [status, setStatus] = useState("Finding you…");
  const [selected, setSelected] = useState<Bin | null>(null);

  const toggleKind = (k: BinKind) =>
    setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("Location unavailable — pan the map instead.");
      setNear([]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const res = await fetch(
          `/api/bins?lat=${p.coords.latitude}&lng=${p.coords.longitude}&limit=8` +
            `&types=${kinds.join(",")}`,
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
  }, [kinds]);

  return (
    <div className="stagger space-y-5">
      <header>
        <h1 className="text-title">Every bin in Singapore</h1>
        <p className="mt-1.5 text-body text-[var(--frost-dim)]">
          13,004 recycling and e-waste points, straight from NEA — including the blue bin at
          the foot of your block. The most common reason something recyclable goes in general
          waste is simply not knowing where the right bin is.
        </p>
      </header>

      <BinMap onSelect={setSelected} kinds={kinds} onToggleKind={toggleKind} />

      {selected && (
        <section className="card pad">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mono text-label text-[var(--aurora-2)]">{kindLabel(selected.kind)}</p>
              <p className="mt-1 font-medium">{selected.name}</p>
              {selected.postal && (
                <p className="mono mt-1 text-label text-[var(--frost-dim)]">
                  Singapore {selected.postal}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Dismiss"
              className="press -mr-2 -mt-2 min-h-11 px-3 text-[var(--frost-dim)]"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selected.streams.map((s) => (
              <span
                key={s}
                className="rounded-full bg-[var(--night-3)] px-3 py-1 text-micro text-[var(--frost-dim)]"
              >
                {s}
              </span>
            ))}
          </div>

          {/* The same page the sticker on this bin opens — so the flow can be
              demonstrated, and used, without a printed QR to hand. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/scan/${selected.code}`}
              className="press btn-primary inline-flex min-h-14 items-center rounded-full px-6 text-body font-medium"
            >
              Log at this bin
            </Link>
            <Link
              href={`/bins/${selected.code}/qr`}
              className="press hoverable inline-flex min-h-14 items-center rounded-full border border-[var(--edge)] px-6 text-body"
            >
              QR sticker
            </Link>
          </div>
        </section>
      )}

      <section>
        <p className="mono text-label text-[var(--frost-dim)]">{status}</p>
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
                className="card press pad flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="mono mt-1 text-label text-[var(--frost-dim)]">
                    {kindLabel(b.kind)}
                    {b.postal ? ` · ${b.postal}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sub font-semibold tabular-nums">{format(b.metres)}</p>
                  <p className="mono text-label text-[var(--frost-dim)]">away</p>
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
  return k === "recycling" ? "Recycling" : "E-waste";
}

function format(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}
