"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import clsx from "clsx";
import type { Bin, BinKind, MapBin } from "@/lib/bins";
import "leaflet/dist/leaflet.css";

const SG_CENTRE: [number, number] = [1.3521, 103.8198];

const KIND_COLOUR: Record<BinKind, string> = {
  recycling: "#3ad9a6",
  ewaste: "#ff7d55",
};

const FILTERS: { kind: BinKind; label: string }[] = [
  { kind: "recycling", label: "Recycling" },
  { kind: "ewaste", label: "E-waste" },
];

export default function BinMap({
  onSelect,
  kinds,
  onToggleKind,
}: {
  onSelect?: (b: Bin) => void;
  /* Owned by the page so the chips drive the nearby list too — they used to
     change the map only, which made the filter quietly lie. */
  kinds: BinKind[];
  onToggleKind: (k: BinKind) => void;
}) {
  const [view, setView] = useState<{ points: MapBin[]; total: number; capped: boolean }>({
    points: [],
    total: 0,
    capped: false,
  });
  const [me, setMe] = useState<[number, number] | null>(null);
  const toggle = onToggleKind;

  /* The map payload carries no names, so the tapped bin is fetched in full. It
     is one small request for the one bin someone actually chose. */
  const openBin = useCallback(
    async (code: string) => {
      try {
        const d = await fetch(`/api/bins/${code}`).then((r) => r.json());
        if (d.bin) onSelect?.(d.bin as Bin);
      } catch {
        /* A dropped lookup should leave the map alone, not blank the sheet. */
      }
    },
    [onSelect],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const on = kinds.includes(f.kind);
          return (
            <button
              key={f.kind}
              onClick={() => toggle(f.kind)}
              aria-pressed={on}
              className={clsx(
                "press min-h-11 rounded-full border px-4 text-meta font-medium",
                on
                  ? "border-transparent text-[var(--night-0)] font-semibold"
                  : "border-[var(--edge)] bg-[var(--night-3)]/50 text-[var(--frost-dim)]",
              )}
              style={on ? { background: KIND_COLOUR[f.kind] } : undefined}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden" style={{ height: "58vh", minHeight: 340 }}>
        <MapContainer
          center={SG_CENTRE}
          zoom={11}
          minZoom={10}
          maxZoom={18}
          scrollWheelZoom
          preferCanvas
          style={{ height: "100%", width: "100%", background: "var(--night-1)" }}
          /* Singapore only — panning to open ocean helps nobody. */
          maxBounds={[
            [1.13, 103.55],
            [1.5, 104.15],
          ]}
          maxBoundsViscosity={0.9}
        >
          <TileLayer
            url="https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png"
            attribution='Map &copy; <a href="https://www.onemap.gov.sg/">OneMap</a> &copy; Singapore Land Authority'
            maxZoom={18}
          />
          <Loader kinds={kinds} onView={setView} />
          <Locate onFound={setMe} />

          {view.points.map(([code, lat, lng, kind]) => (
            <CircleMarker
              key={code}
              center={[lat, lng]}
              /* Small enough that a dense estate reads as texture rather than
                 one blob, big enough to stay a comfortable tap target with the
                 slack Leaflet allows around a path. */
              radius={6}
              eventHandlers={{ click: () => void openBin(code) }}
              pathOptions={{
                color: "#03101a",
                weight: 1.25,
                fillColor: kind === 1 ? KIND_COLOUR.ewaste : KIND_COLOUR.recycling,
                fillOpacity: 0.95,
              }}
            />
          ))}

          {me && (
            <CircleMarker
              center={me}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#0d3b52", fillOpacity: 1 }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-micro text-[var(--frost-dim)]">
        {view.capped
          ? `Showing ${view.points.length.toLocaleString()} of ${view.total.toLocaleString()} bins in view — zoom in for all of them. `
          : view.total > 0
            ? `${view.total.toLocaleString()} ${view.total === 1 ? "bin" : "bins"} in view. `
            : ""}
        Data: NEA via data.gov.sg.
      </p>
    </div>
  );
}

/** Fetches only what the current viewport needs, debounced against panning. */
function Loader({
  kinds,
  onView,
}: {
  kinds: BinKind[];
  onView: (v: { points: MapBin[]; total: number; capped: boolean }) => void;
}) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kindKey = useMemo(() => [...kinds].sort().join(","), [kinds]);

  const load = useCallback(() => {
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(",");
    const url = `/api/bins?bbox=${bbox}&types=${kindKey}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => onView({ points: d.points ?? [], total: d.total ?? 0, capped: !!d.capped }))
      .catch(() => onView({ points: [], total: 0, capped: false }));
  }, [map, kindKey, onView]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 180);
  }, [load]);

  useMapEvents({ moveend: schedule, zoomend: schedule });

  useEffect(() => {
    if (kindKey) load();
    else onView({ points: [], total: 0, capped: false });
  }, [kindKey, load, onView]);

  return null;
}

function Locate({ onFound }: { onFound: (p: [number, number]) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        onFound(p);
        map.setView(p, 15);
      },
      () => {},
      { timeout: 6000 },
    );
  }, [map, onFound]);
  return null;
}
