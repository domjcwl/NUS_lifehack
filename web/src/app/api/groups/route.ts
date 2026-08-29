import { NextResponse } from "next/server";
import { bearHealth, bearMood, streakFrom } from "@/lib/bear";
import { levelFor, stageFor } from "@/lib/level";
import {
  actionsFor,
  createGroup,
  getGroupByCode,
  groupsFor,
  joinGroup,
  leaveGroup,
  membersOf,
  renameGroup,
  xpFor,
} from "@/lib/repo";
import { currentUser } from "@/lib/session";

/** GET — the caller's groups, each with its members' live bear state. */
export async function GET() {
  const me = await currentUser();
  const groups = groupsFor(me.id).map((g) => ({
    ...g,
    members: membersOf(g.id).map((u) => {
      const acts = actionsFor(u.id);
      const last = acts[0]?.at ?? null;
      const xp = xpFor(u.id);
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        isYou: u.id === me.id,
        streak: streakFrom(acts.map((a) => a.at)),
        total: acts.length,
        mood: bearMood(last),
        health: bearHealth(last),
        xp,
        level: levelFor(xp),
        stage: stageFor(levelFor(xp)),
      };
    }),
  }));
  return NextResponse.json({ groups });
}

/** POST — create a group, join one with an invite code, or rename an existing group. */
export async function POST(req: Request) {
  const { name, code, groupId } = (await req.json()) as {
    name?: string;
    code?: string;
    groupId?: string;
  };
  const me = await currentUser();

  if (me.isGuest) {
    return NextResponse.json(
      { error: "Claim a username before joining a group." },
      { status: 403 },
    );
  }

  if (code) {
    const group = getGroupByCode(code);
    if (!group) {
      return NextResponse.json({ error: "No group with that code." }, { status: 404 });
    }
    joinGroup(me.id, group.id);
    return NextResponse.json({ group });
  }

  if (groupId) {
    const trimmed = name?.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Give the group a name." }, { status: 400 });
    }
    const updated = renameGroup(me.id, groupId, trimmed);
    if (!updated) {
      return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
    }
    return NextResponse.json({ group: updated });
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: "Give the group a name." }, { status: 400 });
  }
  return NextResponse.json({ group: createGroup(me.id, name) });
}

export async function DELETE(req: Request) {
  const { groupId } = (await req.json()) as { groupId?: string };
  if (!groupId) return NextResponse.json({ error: "No groupId." }, { status: 400 });
  const me = await currentUser();
  leaveGroup(me.id, groupId);
  return NextResponse.json({ ok: true });
}
