import { nearest, type BinKind } from "@/lib/bins";

export { looksLocational } from "@/lib/places-intent";

/**
 * Answering "where is the nearest bin to <somewhere>".
 *
 * The app already knows where every bin in Singapore is; what it could not do
 * was turn a place someone names into a coordinate. The knowledge service ships
 * a `places.json` containing exactly one entry, so every question about
 * anywhere else came back as "use the map" — which, asked by someone holding a
 * bottle, is not an answer.
 *
 * OneMap's search is the missing half: it is the government's own gazetteer,
 * covers every building and block in Singapore, and needs no key. Paired with
 * `nearest()` it turns a vague question into a named bin and a distance.
 */

/** Where a question points, if anywhere. */
export function placeFrom(text: string): string | null {
  const q = text.trim().replace(/[?!.]+$/, "");
  /* Take what follows the last locational preposition. "nearest recycling bin
     to marina bay sands" and "where can I recycle near jurong point" both end
     with the place, which is the shape these questions almost always take. */
  const m = q.match(/\b(?:to|near|nearest|closest to|around|beside|at|in)\s+(.{3,60})$/i);
  if (!m) return null;
  const place = m[1]
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\b(recycling|e-?waste)?\s*bins?\b/gi, "")
    .trim();
  return place.length >= 3 ? place : null;
}

interface OneMapResult {
  SEARCHVAL?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
  ADDRESS?: string;
}

/** Resolve a Singapore place name to a coordinate, or null. */
export async function resolvePlace(
  place: string,
): Promise<{ name: string; lat: number; lng: number } | null> {
  const url =
    "https://www.onemap.gov.sg/api/common/elastic/search?returnGeom=Y&getAddrDetails=Y&pageNum=1&searchVal=" +
    encodeURIComponent(place);
  try {
    /* Someone is standing at a bin. A lookup that has not answered in four
       seconds has already lost, and the caller falls back to the map. */
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: OneMapResult[] };
    const hit = data.results?.[0];
    if (!hit?.LATITUDE || !hit?.LONGITUDE) return null;
    const lat = Number(hit.LATITUDE);
    const lng = Number(hit.LONGITUDE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { name: hit.SEARCHVAL || hit.ADDRESS || place, lat, lng };
  } catch {
    return null;
  }
}

const metres = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * A full answer for a location question, or null if the place is unknown —
 * in which case the caller keeps whatever answer it already had.
 */
export function answerAt(
  spot: { name: string; lat: number; lng: number },
  kinds: BinKind[] = ["recycling", "ewaste"],
) {
  const bins = nearest(spot.lat, spot.lng, kinds, 3);
  if (!bins.length) return null;
  const [first, ...rest] = bins;
  const lead =
    `The nearest is ${first.name}${first.postal ? ` (S${first.postal})` : ""}, ` +
    `about ${metres(first.metres)} from ${spot.name} — ` +
    `${first.kind === "ewaste" ? "an e-waste point" : "a recycling bin"}.`;
  const also = rest.length
    ? ` Also close: ${rest.map((b) => `${b.name} (${metres(b.metres)})`).join(", ")}.`
    : "";
  return {
    answer: lead + also,
    locations: bins.map((b) => ({
      code: b.code, name: b.name, postal: b.postal, kind: b.kind,
      metres: b.metres, lat: b.lat, lng: b.lng,
    })),
    resolved: { name: spot.name, latitude: spot.lat, longitude: spot.lng, source: "bins" },
  };
}

export async function answerNearest(
  place: string,
  kinds: BinKind[] = ["recycling", "ewaste"],
): Promise<{
  answer: string;
  locations: unknown[];
  resolved: { name: string; latitude: number; longitude: number; source: string };
} | null> {
  const spot = await resolvePlace(place);
  if (!spot) return null;

  const bins = nearest(spot.lat, spot.lng, kinds, 3);
  if (!bins.length) return null;

  const [first, ...rest] = bins;
  const lead =
    `The nearest is ${first.name}${first.postal ? ` (S${first.postal})` : ""}, ` +
    `about ${metres(first.metres)} from ${spot.name} — ` +
    `${first.kind === "ewaste" ? "an e-waste point" : "a recycling bin"}.`;
  const also = rest.length
    ? ` Also close: ${rest.map((b) => `${b.name} (${metres(b.metres)})`).join(", ")}.`
    : "";

  return {
    answer: lead + also,
    locations: bins.map((b) => ({
      code: b.code,
      name: b.name,
      postal: b.postal,
      kind: b.kind,
      metres: b.metres,
      lat: b.lat,
      lng: b.lng,
    })),
    resolved: {
      name: spot.name,
      latitude: spot.lat,
      longitude: spot.lng,
      source: "onemap",
    },
  };
}
