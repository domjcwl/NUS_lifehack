import { NextResponse } from "next/server";
import { binByCode } from "@/lib/bins";
import { bearHealth, bearMood, streakFrom } from "@/lib/bear";
import {
  actionsFor,
  addAction,
  awardPoints,
  getInstance,
  hashSeen,
  markInstanceUsed,
  xpFor,
} from "@/lib/repo";
import { levelFor, levelProgress, stageFor } from "@/lib/level";
import { currentUser } from "@/lib/session";

/** GET /api/log — the signed-in (or guest) user's bear and streak state. */
export async function GET() {
  const user = await currentUser();
  const acts = actionsFor(user.id);
  const last = acts[0]?.at ?? null;
  const xp = xpFor(user.id);
  return NextResponse.json({
    user: { id: user.id, username: user.username, displayName: user.displayName, isGuest: user.isGuest },
    xp,
    level: levelFor(xp),
    levelProgress: levelProgress(xp),
    stage: stageFor(levelFor(xp)),
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
    /** The bin code a printed QR carries. */
    binCode?: string;
    instanceId?: string;
    item?: string;
    confidence?: number;
    reason?: string;
    mediaHash?: string;
    correctlySorted?: boolean;
  };

  const user = await currentUser();

  /* A printed sticker names a bin, not a one-time slot, so an unknown code is
     a bad sticker rather than a spent link. */
  const bin = body.binCode ? binByCode(body.binCode) : null;
  if (body.binCode && !bin) {
    return NextResponse.json({ error: "No bin has that code." }, { status: 404 });
  }

  const inst = body.instanceId ? getInstance(body.instanceId) : null;
  if (body.instanceId && !inst) {
    return NextResponse.json({ error: "That scan link is not valid." }, { status: 404 });
  }
  if (inst?.usedBy) {
    return NextResponse.json({ error: "That scan has already been logged." }, { status: 409 });
  }

  if (body.mediaHash && hashSeen(user.id, body.mediaHash)) {
    return NextResponse.json(
      { error: "You have already logged that exact photo." },
      { status: 409 },
    );
  }

  addAction({
    userId: user.id,
    at: Date.now(),
    binId: bin?.code ?? inst?.binId ?? null,
    item: body.item ?? "unknown",
    verified: true,
    confidence: body.confidence ?? 0,
    reason: body.reason ?? "",
    mediaHash: body.mediaHash ?? null,
  });
  if (inst) markInstanceUsed(inst.id, user.id);

  awardPoints(user.id, "verified");
  if (body.correctlySorted) awardPoints(user.id, "correctStream");

  const acts = actionsFor(user.id);
  const last = acts[0]?.at ?? null;
  const streak = streakFrom(acts.map((a) => a.at));

  /* The run is what is being rewarded, so the bonus lands on the week mark. */
  if (streak > 0 && streak % 7 === 0) awardPoints(user.id, "streakWeek");

  const xp = xpFor(user.id);
  return NextResponse.json({
    streak,
    mood: bearMood(last),
    health: bearHealth(last),
    total: acts.length,
    xp,
    level: levelFor(xp),
    levelProgress: levelProgress(xp),
    stage: stageFor(levelFor(xp)),
  });
}
