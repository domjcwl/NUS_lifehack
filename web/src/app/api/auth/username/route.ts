import { NextResponse } from "next/server";
import { USERNAME_RE, usernameTaken } from "@/lib/repo";

/** Live availability check while the user types. */
export async function GET(req: Request) {
  const u = (new URL(req.url).searchParams.get("u") ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return NextResponse.json({
      available: false,
      reason: "3–20 characters: lowercase letters, numbers or underscore.",
    });
  }
  return NextResponse.json(
    usernameTaken(u)
      ? { available: false, reason: "Already taken." }
      : { available: true, reason: null },
  );
}
