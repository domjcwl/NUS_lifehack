import { NextResponse } from "next/server";
import { createSession, verifyLogin } from "@/lib/repo";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const { username, pin } = (await req.json()) as { username?: string; pin?: string };
  if (!username || !pin) {
    return NextResponse.json({ error: "Username and PIN are required." }, { status: 400 });
  }

  const user = verifyLogin(username, pin);
  /* One message for both wrong-username and wrong-PIN, so the form cannot be
     used to enumerate who has an account. */
  if (!user) {
    return NextResponse.json({ error: "That username and PIN do not match." }, { status: 401 });
  }

  await setSessionCookie(createSession(user.id));
  return NextResponse.json({ user });
}
