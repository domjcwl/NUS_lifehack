import { NextResponse } from "next/server";
import { actionsFor, addAction, createInstance, getInstance, markInstanceUsed } from "@/lib/store";
import { bearHealth, bearMood, streakFrom } from "@/lib/bear";

const USER = "demo";

/** GET /api/log — current bear + streak state. */
export async function GET() {
  const acts = actionsFor(USER);
  const last = acts[0]?.at ?? null;
  return NextResponse.json({
    streak: streakFrom(acts.map((a) => a.at)),
    mood: bearMood(last),
    health: bearHealth(last),
    total: acts.length,
    lastActionAt: last,
    recent: acts.slice(0, 5),
  });
}

/** POST /api/log — record a verified action against a scan instance. */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    instanceId?: string;
    item?: string;
    confidence?: number;
    reason?: string;
  };

  const inst = body.instanceId ? getInstance(body.instanceId) : undefined;
  if (body.instanceId && !inst) {
    return NextResponse.json({ error: "That scan link is not valid." }, { status: 404 });
  }
  if (inst?.usedBy) {
    return NextResponse.json({ error: "That scan has already been logged." }, { status: 409 });
  }

  addAction({
    id: Math.random().toString(36).slice(2, 10),
    userId: USER,
    at: Date.now(),
    binId: inst?.binId ?? null,
    item: body.item ?? "unknown",
    verified: true,
    confidence: body.confidence ?? 0,
    reason: body.reason ?? "",
  });
  if (inst) markInstanceUsed(inst.id, USER);

  const acts = actionsFor(USER);
  const last = acts[0]?.at ?? null;
  return NextResponse.json({
    streak: streakFrom(acts.map((a) => a.at)),
    mood: bearMood(last),
    health: bearHealth(last),
    total: acts.length,
  });
}

/** PUT /api/log — mint a fresh scan instance for a bin (what the QR encodes). */
export async function PUT(req: Request) {
  const { binId } = (await req.json()) as { binId?: string };
  return NextResponse.json(createInstance(binId ?? "tpe-826a"));
}
