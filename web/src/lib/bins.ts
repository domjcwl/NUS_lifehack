import Supercluster from "supercluster";
import raw from "../../data/bins.json";

export type BinKind = "recycling" | "ewaste";

interface RawBin {
  n: string;
  p: string;
  t: string;
  s: string[];
  y: number;
  x: number;
}

export interface Bin {
  id: number;
  name: string;
  postal: string;
  kind: BinKind;
  streams: string[];
  lat: number;
  lng: number;
}

export const BINS: Bin[] = (raw as RawBin[]).map((r, i) => ({
  id: i,
  name: r.n,
  postal: r.p,
  kind: r.t as BinKind,
  streams: r.s,
  lat: r.y,
  lng: r.x,
}));

type Props = { id: number; kind: BinKind };

/**
 * 13,000 points must never reach a phone as one payload. The index lives on the
 * server; the client only ever receives what fits its current viewport.
 */
const indexes = new Map<string, Supercluster<Props>>();

function indexFor(kinds: BinKind[]): Supercluster<Props> {
  const key = [...kinds].sort().join(",");
  const cached = indexes.get(key);
  if (cached) return cached;

  const idx = new Supercluster<Props>({ radius: 70, maxZoom: 17, minPoints: 3 });
  idx.load(
    BINS.filter((b) => kinds.includes(b.kind)).map((b) => ({
      type: "Feature" as const,
      properties: { id: b.id, kind: b.kind },
      geometry: { type: "Point" as const, coordinates: [b.lng, b.lat] },
    })),
  );
  indexes.set(key, idx);
  return idx;
}

export interface ClusterPoint {
  cluster: true;
  id: number;
  count: number;
  lat: number;
  lng: number;
}

export interface SinglePoint {
  cluster: false;
  bin: Bin;
  lat: number;
  lng: number;
}

export type MapPoint = ClusterPoint | SinglePoint;

export function pointsInView(
  bbox: [number, number, number, number],
  zoom: number,
  kinds: BinKind[],
): MapPoint[] {
  return indexFor(kinds)
    .getClusters(bbox, Math.round(zoom))
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      if (f.properties && "cluster" in f.properties && f.properties.cluster) {
        return {
          cluster: true as const,
          id: f.properties.cluster_id as number,
          count: f.properties.point_count as number,
          lat,
          lng,
        };
      }
      return { cluster: false as const, bin: BINS[(f.properties as Props).id], lat, lng };
    });
}

/** Haversine, in metres. */
export function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const p =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(p)));
}

export function nearest(lat: number, lng: number, kinds: BinKind[], limit: number) {
  return BINS.filter((b) => kinds.includes(b.kind))
    .map((b) => ({ ...b, metres: metresBetween(lat, lng, b.lat, b.lng) }))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, limit);
}
