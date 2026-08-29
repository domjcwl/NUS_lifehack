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
  /** Stable public identifier. This is what a printed QR encodes. */
  code: string;
  name: string;
  postal: string;
  kind: BinKind;
  streams: string[];
  lat: number;
  lng: number;
}

/* No 0/O and no 1/I/L — the same alphabet as group invite codes, for the same
   reason: these get read aloud and typed when a sticker is damaged. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * A bin's code is derived from its position and postal code, never from its
 * index in the dataset.
 *
 * This matters because the QR is printed and stuck to a physical bin, then
 * outlives the data behind it. `bins.json` is rebuilt from NEA's feed by
 * `scripts/build-bins.py`; if a code were an array index, one upstream
 * insertion would silently repoint every sticker in Singapore at the wrong
 * bin. Deriving it from the coordinates means a rebuild produces the same code
 * for the same physical bin.
 *
 * FNV-1a rather than a crypto hash so this file stays importable from client
 * components — there is nothing to protect here, only something to keep stable.
 */
function codeFor(postal: string, lat: number, lng: number): string {
  const seed = `${postal}|${lat.toFixed(5)},${lng.toFixed(5)}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + seed.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  /* Two 32-bit halves, four characters each. Deliberately no BigInt: the
     tsconfig target is below ES2020, and 64-bit literals are not worth
     changing the build target for. */
  const n = CODE_ALPHABET.length;
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[h1 % n];
    h1 = Math.floor(h1 / n);
  }
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[h2 % n];
    h2 = Math.floor(h2 / n);
  }
  return out;
}

export const BINS: Bin[] = (() => {
  const seen = new Set<string>();
  const bins: Bin[] = [];

  for (const [i, r] of (raw as RawBin[]).entries()) {
    const bin: Bin = {
      id: i,
      code: codeFor(r.p, r.y, r.x),
      name: r.n,
      postal: r.p,
      kind: r.t as BinKind,
      streams: r.s,
      lat: r.y,
      lng: r.x,
    };

    if (seen.has(bin.code)) {
      /* Same spot, same postal: genuinely the same physical location listed twice
         upstream. Keep the first and let both resolve to it to avoid duplicate map marks
         and broken selection states. */
      continue;
    }

    seen.add(bin.code);
    bins.push(bin);
  }

  return bins;
})();

/* Built once. A collision would mean two bins sharing a sticker, so it is
   worth knowing about at boot rather than in a corridor. */
const BY_CODE = new Map<string, Bin>();
for (const b of BINS) {
  const clash = BY_CODE.get(b.code);
  if (clash) {
    if (clash.lat !== b.lat || clash.lng !== b.lng) {
      console.warn(`[bins] code collision ${b.code}: "${clash.name}" vs "${b.name}"`);
    }
    continue;
  }
  BY_CODE.set(b.code, b);
}

export function binByCode(code: string): Bin | null {
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

/**
 * Bins inside the current viewport.
 *
 * There is no clustering. 13,000 points still must not reach a phone as one
 * payload, so the viewport does the reducing instead: the client is sent only
 * what is on screen, up to `limit`, and is told the true total so it can say so
 * rather than quietly showing a fraction.
 *
 * A linear scan over 13,004 rows is well under a millisecond and avoids keeping
 * a spatial index in memory per filter combination.
 */
/**
 * A map point: code, latitude, longitude, kind. A tuple rather than an object
 * because this is the one payload that scales with the map — 1,200 objects with
 * repeated keys and every field a bin has came to 196KB per pan, which is not
 * something to send a phone on mobile data every time it moves. The same 1,200
 * as tuples carrying only what draws a dot is roughly a quarter of that, and
 * the rest of a bin is fetched only for the one the user actually taps.
 */
export type MapBin = [code: string, lat: number, lng: number, kind: 0 | 1];

export interface BinsInView {
  points: MapBin[];
  /** How many are actually in this viewport, before the cap. */
  total: number;
  capped: boolean;
}

const slim = (b: Bin): MapBin => [b.code, b.lat, b.lng, b.kind === "ewaste" ? 1 : 0];

export function binsInView(
  bbox: [number, number, number, number],
  kinds: BinKind[],
  limit = 1200,
): BinsInView {
  const [west, south, east, north] = bbox;
  const hits: Bin[] = [];
  for (const b of BINS) {
    if (!kinds.includes(b.kind)) continue;
    if (b.lng < west || b.lng > east || b.lat < south || b.lat > north) continue;
    hits.push(b);
  }

  if (hits.length <= limit) {
    return { points: hits.map(slim), total: hits.length, capped: false };
  }

  /* Over the cap, take an even stride rather than the first N. The dataset is
     ordered by NEA's own listing, so the first N would land in whichever town
     happens to come first and leave the rest of the viewport empty. */
  const stride = hits.length / limit;
  const sampled: MapBin[] = [];
  for (let i = 0; i < limit; i++) sampled.push(slim(hits[Math.floor(i * stride)]));
  return { points: sampled, total: hits.length, capped: true };
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
