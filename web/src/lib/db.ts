import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * SQLite via node:sqlite — built into Node 22+, so there is no native module to
 * compile. That matters on Windows, where better-sqlite3 needs build tools.
 *
 * This file owns the connection and schema only. Every query lives in repo.ts,
 * which is the single file to replace when the real backend lands.
 */

/**
 * Where the database file lives.
 *
 * Locally that is `web/data/floe.db`, which persists and is the real store.
 *
 * On Vercel the filesystem is read-only apart from `/tmp`, so writing anywhere
 * else throws on the first request that touches the database and takes down
 * signup, login, scanning and the leaderboard with it. `/tmp` keeps the app
 * alive there, but it is per-instance and disappears with the instance: an
 * account made on one request may be gone on the next. That is adequate for a
 * hosted preview and is NOT adequate for the judged demo, which runs against a
 * real file on a real machine. The permanent fix is a hosted database behind
 * `repo.ts` — see docs/decisions.md.
 */
const DB_PATH =
  process.env.FLOE_DB_PATH ??
  (process.env.VERCEL ? "/tmp/floe.db" : path.join(process.cwd(), "data", "floe.db"));

const g = globalThis as unknown as { __floeDb?: DatabaseSync };

function migrate(db: DatabaseSync) {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      username       TEXT,
      username_lower TEXT UNIQUE,
      display_name   TEXT NOT NULL,
      pin_hash       TEXT,
      pin_salt       TEXT,
      is_guest       INTEGER NOT NULL DEFAULT 1,
      created_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      at         INTEGER NOT NULL,
      bin_id     TEXT,
      item       TEXT NOT NULL,
      verified   INTEGER NOT NULL,
      confidence REAL,
      reason     TEXT,
      media_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      creator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );

    /* A ledger rather than a running total, so every point can be explained. */
    CREATE TABLE IF NOT EXISTS point_transactions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      points     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS scan_instances (
      id         TEXT PRIMARY KEY,
      bin_id     TEXT,
      created_at INTEGER NOT NULL,
      used_by    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_actions_user ON actions(user_id, at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_actions_hash ON actions(user_id, media_hash)
      WHERE media_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_points_user ON point_transactions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_members_user ON group_members(user_id);
  `);
}

/**
 * CREATE TABLE IF NOT EXISTS cannot add a column to a table that already
 * exists, so an existing floe.db needs the new columns applied explicitly.
 */
function addMissingColumns(db: DatabaseSync) {
  const wanted: Record<string, string> = { media_hash: "TEXT" };
  const existing = new Set(
    (db.prepare("PRAGMA table_info(actions)").all() as Record<string, unknown>[]).map((c) =>
      String(c.name),
    ),
  );
  for (const [column, type] of Object.entries(wanted)) {
    if (!existing.has(column)) db.exec(`ALTER TABLE actions ADD COLUMN ${column} ${type}`);
  }
}

export function db(): DatabaseSync {
  if (!g.__floeDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    migrate(conn);
    addMissingColumns(conn);
    g.__floeDb = conn;
  }
  return g.__floeDb;
}
