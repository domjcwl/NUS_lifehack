import { NextResponse } from "next/server";
import { bearHealth, bearMood, streakFrom } from "@/lib/bear";
import { actionsFor, groupsFor, updateProfile, xpFor } from "@/lib/repo";
import { levelFor, stageFor } from "@/lib/level";
import { currentUser } from "@/lib/session";
import { computeStats } from "@/lib/stats";

/** GET — the profile screen's whole payload in one request. */
export async function GET() {
  const user = await currentUser();
  const actions = actionsFor(user.id);
  const times = actions.map((a) => a.at);
  const last = times.length ? Math.max(...times) : null;

  return NextResponse.json({
    user,
    groupCount: groupsFor(user.id).length,
    xp: xpFor(user.id),
    level: levelFor(xpFor(user.id)),
    stage: stageFor(levelFor(xpFor(user.id))),
    mood: bearMood(last),
    health: bearHealth(last),
    stats: {
      ...computeStats(actions),
      /* The forgiveness rule (today-unlogged is not a break) lives in bear.ts,
         so the current streak comes from there rather than being recomputed. */
      currentStreak: streakFrom(times),
    },
  });
}

/** PATCH — rename the account. */
export async function PATCH(req: Request) {
  const { username, displayName } = (await req.json()) as {
    username?: string;
    displayName?: string;
  };
  if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });

  const user = await currentUser();
  const result = updateProfile(user.id, username, displayName ?? username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ user: result.user });
}
