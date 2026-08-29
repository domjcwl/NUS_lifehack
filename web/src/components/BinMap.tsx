"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import clsx from "clsx";
import type { Bin, BinKind, MapBin } from "@/lib/bins";
import "leaflet/dist/leaflet.css";

const SG_CENTRE: [number, number] = [1.3521, 103.8198];

/*
 * Canvas, with hit slop. Canvas because a thousand SVG paths is what makes a
 * map stutter on a phone; the tolerance because a 2.6px dot zoomed out is a
 * 2.6px tap target otherwise, and a tap that lands on nothing reads as the app
 * being broken rather than as the user having missed. The module only ever
 * loads in the browser — the map is imported with ssr:false.
 */
const RENDERER = L.canvas({ padding: 0.4, tolerance: 8 });

const KIND_COLOUR: Record<BinKind, string> = {
  recycling: "#3ad9a6",
  ewaste: "#ff7d55",
};

/**
 * A dot's size, weight and opacity all follow zoom, because the same mark is
 * doing two different jobs.
 *
 * Zoomed out there are over a thousand of them and no one is picking one out —
 * they are showing where Singapore recycles, and they should read as texture.
 * Small, unstroked and semi-transparent, they overlap into density instead of
 * piling into a rash of bright blobs.
 *
 * Zoomed in there are a few dozen and each is a place you might walk to, so it
 * earns size, a dark rim to lift it off the map, and full opacity.
 */
function dotStyle(zoom: number) {
  if (zoom <= 12) return { radius: 2.6, stroke: false, weight: 0, fillOpacity: 0.6 };
  if (zoom <= 14) return { radius: 4, stroke: true, weight: 0.75, fillOpacity: 0.8 };
  return { radius: 6.5, stroke: true, weight: 1.25, fillOpacity: 0.95 };
}

const FILTERS: { kind: BinKind; label: string }[] = [
  { kind: "recycling", label: "Recycling" },
  { kind: "ewaste", label: "E-waste" },
];

export default function BinMap({
  onSelect,
  kinds,
  onToggleKind,
  focus,
  selectedCode,
}: {
  onSelect?: (b: Bin) => void;
  /* Somewhere to fly to, set when a row in the nearby list is tapped. The nonce
     is what makes tapping the same row twice fly there again. */
  focus?: { lat: number; lng: number; nonce: number } | null;
  /** Drawn larger and ringed, so "the map moved" becomes "here it is". */
  selectedCode?: string | null;
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
  const [zoom, setZoom] = useState(11);
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

  const dot = dotStyle(zoom);

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
          renderer={RENDERER}
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
            /* Let the app's own ground show through. The tiles are reference,
               not the subject — the bins should be the brightest thing here. */
            opacity={0.82}
          />
          <Loader kinds={kinds} onView={setView} />
          <ZoomWatch onZoom={setZoom} />
          <FlyTo target={focus ?? null} />
          <Locate onFound={setMe} />

          {view.points.map(([code, lat, lng, kind]) => {
            const chosen = code === selectedCode;
            return (
              <CircleMarker
                key={code}
                center={[lat, lng]}
                radius={chosen ? Math.max(dot.radius, 8) : dot.radius}
                eventHandlers={{ click: () => void openBin(code) }}
                pathOptions={{
                  /* A white rim rather than another colour: the two fills already
                     mean recycling and e-waste, and a third hue would be a third
                     thing to learn. */
                  color: chosen ? "#ffffff" : "#03101a",
                  stroke: chosen ? true : dot.stroke,
                  weight: chosen ? 2 : dot.weight,
                  fillColor: kind === 1 ? KIND_COLOUR.ewaste : KIND_COLOUR.recycling,
                  fillOpacity: chosen ? 1 : dot.fillOpacity,
                }}
              />
            );
          })}

          {/* You, as a ring rather than a filled disc — it has to be findable
              without competing with the bins, which are what you came for. */}
          {me && (
            <CircleMarker
              center={me}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                weight: 2.5,
                fillColor: "#b9e4f6",
                fillOpacity: 0.35,
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Two different things: what you are looking at right now, and the
          credit that has to be there whatever the map is showing. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-micro text-[var(--frost-dim)]">
          {view.capped
            ? `${view.points.length.toLocaleString()} of ${view.total.toLocaleString()} in view — zoom in for all`
            : view.total > 0
              ? `${view.total.toLocaleString()} ${view.total === 1 ? "bin" : "bins"} in view`
              : " "}
        </p>
        <p className="text-micro text-[var(--frost-faint)]">NEA via data.gov.sg</p>
      </div>
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

/**
 * Moves the map to a bin picked from the list below it.
 *
 * Zoom 17 rather than the map's maximum: close enough that the bin is
 * unambiguous, far enough that the street it sits on is still legible, which is
 * what someone about to walk there actually needs.
 */
function FlyTo({ target }: { target: { lat: number; lng: number; nonce: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) map.setView([target.lat, target.lng], 17);
    else map.flyTo([target.lat, target.lng], 17, { duration: 0.9 });
  }, [target, map]);
  return null;
}

/** Zoom drives how the dots are drawn, so it is tracked on its own. */
function ZoomWatch({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
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
