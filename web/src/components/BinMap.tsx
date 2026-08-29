"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import clsx from "clsx";
import type { Bin, BinKind, MapPoint } from "@/lib/bins";
import "leaflet/dist/leaflet.css";

const SG_CENTRE: [number, number] = [1.3521, 103.8198];

const iconCache = new Map<number, L.DivIcon>();

function clusterIcon(count: number): L.DivIcon {
  const cached = iconCache.get(count);
  if (cached) return cached;
  const size = Math.round(Math.min(54, 26 + Math.log2(count) * 5));
  const icon = L.divIcon({
    html: `<span>${count}</span>`,
    className: "bin-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(count, icon);
  return icon;
}

const KIND_COLOUR: Record<BinKind, string> = {
  recycling: "#3ad9a6",
  ewaste: "#ff7d55",
  lighting: "#f2bc4c",
};

const FILTERS: { kind: BinKind; label: string }[] = [
  { kind: "recycling", label: "Recycling" },
  { kind: "ewaste", label: "E-waste" },
  { kind: "lighting", label: "Lamps" },
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
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [me, setMe] = useState<[number, number] | null>(null);
  const toggle = onToggleKind;

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
                "press min-h-11 rounded-full border px-4 text-[0.85rem] font-medium",
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
          <Loader kinds={kinds} onPoints={setPoints} />
          <Locate onFound={setMe} />

          {points.map((p) =>
            p.cluster ? (
              <Marker
                key={`c${p.lat},${p.lng},${p.count}`}
                position={[p.lat, p.lng]}
                icon={clusterIcon(p.count)}
              />
            ) : (
              <CircleMarker
                key={`b${p.bin.id}`}
                center={[p.lat, p.lng]}
                radius={7}
                eventHandlers={{ click: () => onSelect?.(p.bin) }}
                pathOptions={{
                  color: "#03101a",
                  weight: 1.5,
                  fillColor: KIND_COLOUR[p.bin.kind],
                  fillOpacity: 0.95,
                }}
              >
                <Tooltip>{p.bin.name}</Tooltip>
              </CircleMarker>
            ),
          )}

          {me && (
            <CircleMarker
              center={me}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#0d3b52", fillOpacity: 1 }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-[11px] text-[var(--frost-dim)]">
        Circles group nearby points — zoom in to split them. Data: NEA via data.gov.sg.
      </p>
    </div>
  );
}

/** Fetches only what the current viewport needs, debounced against panning. */
function Loader({ kinds, onPoints }: { kinds: BinKind[]; onPoints: (p: MapPoint[]) => void }) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kindKey = useMemo(() => [...kinds].sort().join(","), [kinds]);

  const load = useCallback(() => {
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(",");
    const url = `/api/bins?bbox=${bbox}&zoom=${map.getZoom()}&types=${kindKey}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => onPoints(d.points ?? []))
      .catch(() => onPoints([]));
  }, [map, kindKey, onPoints]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 180);
  }, [load]);

  useMapEvents({ moveend: schedule, zoomend: schedule });

  useEffect(() => {
    if (kindKey) load();
    else onPoints([]);
  }, [kindKey, load, onPoints]);

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
