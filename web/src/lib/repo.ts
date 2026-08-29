import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db";

/**
 * The whole data layer. Every query in the app lives here, so swapping SQLite
 * for the real backend means reimplementing this one module's exports and
 * touching nothing else.
 */

export interface User {
  id: string;
  username: string | null;
  displayName: string;
  isGuest: boolean;
  createdAt: number;
}

export interface ActionRow {
  id: string;
  userId: string;
  at: number;
  binId: string | null;
  item: string;
  verified: boolean;
  confidence: number;
  reason: string;
}

const id = () => randomBytes(9).toString("base64url");

/* ── Usernames ─────────────────────────────────────────────────────────── */

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Returns the problem, or null if the handle is usable. */
export function validateUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return "Use 3–20 characters: lowercase letters, numbers or underscore.";
  }
  if (usernameTaken(u)) return "That username is taken.";
  return null;
}

export function usernameTaken(username: string): boolean {
  const row = db()
    .prepare("SELECT 1 AS x FROM users WHERE username_lower = ?")
    .get(username.trim().toLowerCase());
  return row !== undefined;
}

/* ── PINs ──────────────────────────────────────────────────────────────── */

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 32).toString("hex");
}

function pinMatches(pin: string, salt: string, expected: string): boolean {
  const a = Buffer.from(hashPin(pin, salt), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ── Users ─────────────────────────────────────────────────────────────── */

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    username: r.username === null ? null : String(r.username),
    displayName: String(r.display_name),
    isGuest: Number(r.is_guest) === 1,
    createdAt: Number(r.created_at),
  };
}

export function createGuest(): User {
  const user = {
    id: id(),
    display_name: "Guest",
    created_at: Date.now(),
  };
  db()
    .prepare(
      "INSERT INTO users (id, username, username_lower, display_name, is_guest, created_at) VALUES (?, NULL, NULL, ?, 1, ?)",
    )
    .run(user.id, user.display_name, user.created_at);
  return getUser(user.id)!;
}

export function getUser(userId: string): User | null {
  const r = db().prepare("SELECT * FROM users WHERE id = ?").get(userId);
  return r ? rowToUser(r as Record<string, unknown>) : null;
}

export function getUserByUsername(username: string): User | null {
  const r = db()
    .prepare("SELECT * FROM users WHERE username_lower = ?")
    .get(username.trim().toLowerCase());
  return r ? rowToUser(r as Record<string, unknown>) : null;
}

/**
 * Turns a guest into a real account in place, so the streak they built before
 * signing up survives. That is the whole point of the guest-first flow.
 */
export function claimAccount(
  userId: string,
  username: string,
  displayName: string,
  pin: string,
): { ok: true; user: User } | { ok: false; error: string } {
  const problem = validateUsername(username);
  if (problem) return { ok: false, error: problem };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "PIN must be 4–8 digits." };

  const salt = randomBytes(16).toString("hex");
  const lower = username.trim().toLowerCase();
  try {
    db()
      .prepare(
        `UPDATE users SET username = ?, username_lower = ?, display_name = ?,
         pin_hash = ?, pin_salt = ?, is_guest = 0 WHERE id = ?`,
      )
      .run(lower, lower, displayName.trim() || lower, hashPin(pin, salt), salt, userId);
  } catch {
    return { ok: false, error: "That username is taken." };
  }
  return { ok: true, user: getUser(userId)! };
}

export function verifyLogin(username: string, pin: string): User | null {
  const r = db()
    .prepare("SELECT * FROM users WHERE username_lower = ?")
    .get(username.trim().toLowerCase()) as Record<string, unknown> | undefined;
  if (!r || r.pin_hash === null || r.pin_salt === null) return null;
  if (!pinMatches(pin, String(r.pin_salt), String(r.pin_hash))) return null;
  return rowToUser(r);
}

/* ── Sessions ──────────────────────────────────────────────────────────── */

export function createSession(userId: string): string {
  const token = randomBytes(24).toString("base64url");
  db()
    .prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)")
    .run(token, userId, Date.now());
  return token;
}

export function userForSession(token: string | undefined): User | null {
  if (!token) return null;
  const r = db()
    .prepare(
      "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
    )
    .get(token);
  return r ? rowToUser(r as Record<string, unknown>) : null;
}

export function destroySession(token: string | undefined): void {
  if (token) db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/* ── Actions ───────────────────────────────────────────────────────────── */

export function addAction(a: Omit<ActionRow, "id">): void {
  db()
    .prepare(
      `INSERT INTO actions (id, user_id, at, bin_id, item, verified, confidence, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id(), a.userId, a.at, a.binId, a.item, a.verified ? 1 : 0, a.confidence, a.reason);
}

export function actionsFor(userId: string): ActionRow[] {
  const rows = db()
    .prepare("SELECT * FROM actions WHERE user_id = ? AND verified = 1 ORDER BY at DESC")
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    at: Number(r.at),
    binId: r.bin_id === null ? null : String(r.bin_id),
    item: String(r.item),
    verified: Number(r.verified) === 1,
    confidence: Number(r.confidence ?? 0),
    reason: String(r.reason ?? ""),
  }));
}

/** Seeds a short prior history so a new profile opens on a live streak. */
export function seedHistory(userId: string): void {
  const DAY = 86_400_000;
  const now = Date.now();
  const items = ["plastic bottle", "aluminium can", "paper cup sleeve", "cardboard box"];
  [1, 2, 3, 5, 6, 8].forEach((daysAgo, i) => {
    addAction({
      userId,
      at: now - daysAgo * DAY + 3_600_000,
      binId: "tpe-826a",
      item: items[i % items.length],
      verified: true,
      confidence: 0.9,
      reason: "Seeded demo history.",
    });
  });
}

/* ── Friends ───────────────────────────────────────────────────────────── */

/** Mutual on add — a hackathon simplification, noted in the README. */
export function addFriend(userId: string, friendId: string): void {
  if (userId === friendId) return;
  const stmt = db().prepare(
    "INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)",
  );
  const now = Date.now();
  stmt.run(userId, friendId, now);
  stmt.run(friendId, userId, now);
}

export function removeFriend(userId: string, friendId: string): void {
  const stmt = db().prepare(
    "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?",
  );
  stmt.run(userId, friendId);
  stmt.run(friendId, userId);
}

export function friendsOf(userId: string): User[] {
  const rows = db()
    .prepare(
      `SELECT u.* FROM friendships f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ? ORDER BY u.display_name`,
    )
    .all(userId) as Record<string, unknown>[];
  return rows.map(rowToUser);
}

export function isFriend(userId: string, friendId: string): boolean {
  return (
    db()
      .prepare("SELECT 1 AS x FROM friendships WHERE user_id = ? AND friend_id = ?")
      .get(userId, friendId) !== undefined
  );
}

/** Prefix-first search over claimed accounts, excluding the searcher. */
export function searchUsers(query: string, excludeId: string, limit = 12): User[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = db()
    .prepare(
      `SELECT * FROM users
       WHERE is_guest = 0 AND id != ? AND (username_lower LIKE ? OR lower(display_name) LIKE ?)
       ORDER BY CASE WHEN username_lower LIKE ? THEN 0 ELSE 1 END, username_lower
       LIMIT ?`,
    )
    .all(excludeId, `%${q}%`, `%${q}%`, `${q}%`, limit) as Record<string, unknown>[];
  return rows.map(rowToUser);
}

/* ── Scan instances ────────────────────────────────────────────────────── */

export function createInstance(binId: string) {
  const inst = { id: id(), binId, createdAt: Date.now(), usedBy: null as string | null };
  db()
    .prepare("INSERT INTO scan_instances (id, bin_id, created_at, used_by) VALUES (?, ?, ?, NULL)")
    .run(inst.id, inst.binId, inst.createdAt);
  return inst;
}

export function getInstance(instanceId: string) {
  const r = db().prepare("SELECT * FROM scan_instances WHERE id = ?").get(instanceId) as
    | Record<string, unknown>
    | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    binId: r.bin_id === null ? null : String(r.bin_id),
    createdAt: Number(r.created_at),
    usedBy: r.used_by === null ? null : String(r.used_by),
  };
}

export function markInstanceUsed(instanceId: string, userId: string): void {
  db().prepare("UPDATE scan_instances SET used_by = ? WHERE id = ?").run(userId, instanceId);
}
