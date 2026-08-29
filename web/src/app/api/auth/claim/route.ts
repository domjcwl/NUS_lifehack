import { NextResponse } from "next/server";
import { claimAccount } from "@/lib/repo";
import { currentUser } from "@/lib/session";

/**
 * Converts the caller's guest row into a real account in place, so the streak
 * they already built carries over instead of starting again.
 */
export async function POST(req: Request) {
  const { username, displayName, pin } = (await req.json()) as {
    username?: string;
    displayName?: string;
    pin?: string;
  };
  if (!username || !pin) {
    return NextResponse.json({ error: "Username and PIN are required." }, { status: 400 });
  }

  const user = await currentUser();
  if (!user.isGuest) {
    return NextResponse.json({ error: "You are already signed in." }, { status: 409 });
  }

  const result = claimAccount(user.id, username, displayName ?? username, pin);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ user: result.user });
}
