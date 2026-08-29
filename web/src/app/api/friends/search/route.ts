import { NextResponse } from "next/server";
import { isFriend, searchUsers } from "@/lib/repo";
import { currentUser } from "@/lib/session";

/** Search claimed accounts by username or display name. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const me = await currentUser();
  const results = searchUsers(q, me.id).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    added: isFriend(me.id, u.id),
  }));
  return NextResponse.json({ results });
}
