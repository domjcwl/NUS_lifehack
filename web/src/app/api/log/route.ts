import { NextResponse } from "next/server";
import { bearHealth, bearMood, streakFrom } from "@/lib/bear";
import { actionsFor, addAction, createInstance, getInstance, markInstanceUsed } from "@/lib/repo";
import { currentUser } from "@/lib/session";

/** GET /api/log — the signed-in (or guest) user's bear and streak state. */
export async function GET() {
  const user = await currentUser();
  const acts = actionsFor(user.id);
  const last = acts[0]?.at ?? null;
  return NextResponse.json({
    user: { id: user.id, username: user.username, displayName: user.displayName, isGuest: user.isGuest },
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

  const user = await currentUser();
  const inst = body.instanceId ? getInstance(body.instanceId) : null;
  if (body.instanceId && !inst) {
    return NextResponse.json({ error: "That scan link is not valid." }, { status: 404 });
  }
  if (inst?.usedBy) {
    return NextResponse.json({ error: "That scan has already been logged." }, { status: 409 });
  }

  addAction({
    userId: user.id,
    at: Date.now(),
    binId: inst?.binId ?? null,
    item: body.item ?? "unknown",
    verified: true,
    confidence: body.confidence ?? 0,
    reason: body.reason ?? "",
  });
  if (inst) markInstanceUsed(inst.id, user.id);

  const acts = actionsFor(user.id);
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
