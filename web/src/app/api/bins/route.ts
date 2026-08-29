import { NextResponse } from "next/server";
import { nearest, pointsInView, type BinKind } from "@/lib/bins";

const ALL: BinKind[] = ["recycling", "ewaste"];

function kindsFrom(param: string | null): BinKind[] {
  if (!param) return ALL;
  const wanted = param.split(",").filter((k): k is BinKind => ALL.includes(k as BinKind));
  return wanted.length ? wanted : ALL;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const kinds = kindsFrom(q.get("types"));

  const bbox = q.get("bbox");
  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) {
      return NextResponse.json({ error: "bbox must be w,s,e,n" }, { status: 400 });
    }
    const zoom = Number(q.get("zoom") ?? 12);
    return NextResponse.json({
      points: pointsInView(parts as [number, number, number, number], zoom, kinds),
    });
  }

  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Supply bbox, or lat and lng." }, { status: 400 });
  }
  const limit = Math.min(Number(q.get("limit") ?? 10), 50);
  return NextResponse.json({ bins: nearest(lat, lng, kinds, limit) });
}
