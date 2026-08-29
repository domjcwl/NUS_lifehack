import { NextResponse } from "next/server";
import { bearHealth, bearMood, streakFrom } from "@/lib/bear";
import { actionsFor, addFriend, friendsOf, getUserByUsername, removeFriend } from "@/lib/repo";
import { currentUser } from "@/lib/session";

/** Each friend carries their live bear state — that is the point of the list. */
export async function GET() {
  const me = await currentUser();
  const friends = friendsOf(me.id).map((f) => {
    const acts = actionsFor(f.id);
    const last = acts[0]?.at ?? null;
    return {
      id: f.id,
      username: f.username,
      displayName: f.displayName,
      streak: streakFrom(acts.map((a) => a.at)),
      total: acts.length,
      mood: bearMood(last),
      health: bearHealth(last),
      lastActionAt: last,
    };
  });
  return NextResponse.json({ friends });
}

export async function POST(req: Request) {
  const { username } = (await req.json()) as { username?: string };
  if (!username) return NextResponse.json({ error: "No username." }, { status: 400 });

  const me = await currentUser();
  if (me.isGuest) {
    return NextResponse.json(
      { error: "Claim a username before adding friends." },
      { status: 403 },
    );
  }

  const target = getUserByUsername(username);
  if (!target || target.isGuest) {
    return NextResponse.json({ error: "No account with that username." }, { status: 404 });
  }
  if (target.id === me.id) {
    return NextResponse.json({ error: "That is you." }, { status: 400 });
  }

  addFriend(me.id, target.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { friendId } = (await req.json()) as { friendId?: string };
  if (!friendId) return NextResponse.json({ error: "No friendId." }, { status: 400 });
  const me = await currentUser();
  removeFriend(me.id, friendId);
  return NextResponse.json({ ok: true });
}
