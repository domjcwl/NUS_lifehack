"use client";

import { useEffect, useState } from "react";
import { BINS } from "@/lib/store";

/** Haversine, in metres. Good enough for a campus. */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const p =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(p)));
}

export default function Bins() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState("Locating…");

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("Location unavailable — showing all points.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus("Sorted by distance from you.");
      },
      () => setStatus("Location declined — showing all points."),
      { timeout: 6000 },
    );
  }, []);

  const list = BINS.map((b) => ({
    ...b,
    metres: pos ? metresBetween(pos.lat, pos.lng, b.lat, b.lng) : null,
  })).sort((x, y) => (x.metres ?? 0) - (y.metres ?? 0));

  return (
    <div className="space-y-5 rise">
      <header>
        <p className="mono text-[10px] text-[var(--ink-soft)]">Friction remover</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Nearest points</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          The most common reason a bottle goes in general waste is not knowing where the
          right bin is. {status}
        </p>
      </header>

      <ul className="stagger space-y-3">
        {list.map((b) => (
          <li key={b.id} className="card press flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium">{b.name}</p>
              <p className="mono mt-1 text-[10px] text-[var(--ink-soft)]">{b.block}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.streams.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[var(--ice-1)] px-2 py-0.5 text-[10px] text-[var(--ink-soft)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {b.metres === null ? (
                <span className="mono text-[10px] text-[var(--ink-soft)]">—</span>
              ) : (
                <>
                  <p className="text-lg font-semibold tabular-nums">{b.metres}</p>
                  <p className="mono text-[9px] text-[var(--ink-soft)]">metres</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
