import { NextResponse } from "next/server";
import { destroySession } from "@/lib/repo";
import { clearSessionCookie, sessionToken } from "@/lib/session";

export async function POST() {
  destroySession(await sessionToken());
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
