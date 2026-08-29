import { cookies } from "next/headers";
import { createGuest, createSession, seedHistory, userForSession, type User } from "./repo";

export const SESSION_COOKIE = "floe_session";

/**
 * Everyone gets an identity immediately — a guest row with a real session — so
 * the app works before anyone signs up and the streak they build survives being
 * claimed later. That is the guest-first flow, not an anonymous special case.
 */
export async function currentUser(): Promise<User> {
  const jar = await cookies();
  const existing = userForSession(jar.get(SESSION_COOKIE)?.value);
  if (existing) return existing;

  const guest = createGuest();
  seedHistory(guest.id);
  const token = createSession(guest.id);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return guest;
}

/** Read-only: never mints a guest. Use where a missing session is meaningful. */
export async function currentUserOrNull(): Promise<User | null> {
  const jar = await cookies();
  return userForSession(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}
