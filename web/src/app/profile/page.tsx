"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Bear from "@/components/Bear";

import { BEAR_COPY } from "@/lib/bear";
import type { BearMood, Me } from "@/lib/types";

interface Stats {
  total: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  thisWeek: number;
  lastWeek: number;
  perWeek: number;
  firstActionAt: number | null;
  daysSinceStart: number;
  materials: { material: string; count: number }[];
}

interface Payload {
  user: Me & { createdAt: number };
  groupCount: number;
  xp: number;
  level: number;
  stage: string;
  mood: BearMood;
  health: number;
  stats: Stats;
}

const MATERIAL_COLOUR: Record<string, string> = {
  plastic: "#1baf7a",
  paper: "#2ba7cd",
  metal: "#f2bc4c",
  glass: "#7b6ce0",
  other: "#61798a",
};

export default function Profile() {
  const [data, setData] = useState<Payload | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/auth/profile")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(load, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: draft, displayName: draft }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save that.");
      setEditing(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <div className="card card-lg h-96 animate-pulse opacity-50" />;

  const { user, stats } = data;
  const since = stats.firstActionAt
    ? new Date(stats.firstActionAt).toLocaleDateString("en-SG", { day: "numeric", month: "long" })
    : null;
  const trend = stats.thisWeek - stats.lastWeek;

  return (
    <div className="space-y-9">
      <section className="rise">
        <div className="card card-lg overflow-hidden">
          <Bear mood={data.mood} health={data.health} level={data.level} />
          <div className="px-5 pb-5 pt-4">
            {editing ? (
              <div>
                <label htmlFor="uname" className="mono text-[10px] text-[var(--frost-faint)]">
                  Username
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--edge)] bg-[var(--night-2)] px-4">
                  <span className="text-[var(--frost-faint)]">@</span>
                  <input
                    id="uname"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    /* 16px minimum, or iOS zooms the viewport on focus. */
                    className="min-h-14 flex-1 bg-transparent text-base outline-none"
                  />
                </div>
                {error && <p className="mt-2 text-[0.85rem] text-[var(--coral)]">{error}</p>}
                <div className="mt-3 flex gap-2.5">
                  <button
                    onClick={save}
                    disabled={saving || draft.length < 3}
                    className="press btn-primary min-h-12 flex-1 rounded-full text-[0.9rem] disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setError(null);
                    }}
                    className="press hoverable min-h-12 rounded-full border border-[var(--edge)] px-5 text-[0.9rem]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-[2rem]">
                    {user.isGuest ? "Guest" : `@${user.username}`}
                  </h1>
                  <p className="mt-1 text-[0.95rem] text-[var(--frost-dim)]">
                    {BEAR_COPY[data.mood].title}
                  </p>
                </div>
                {!user.isGuest && (
                  <button
                    onClick={() => {
                      setDraft(user.username ?? "");
                      setEditing(true);
                    }}
                    className="press hoverable min-h-11 shrink-0 rounded-full border border-[var(--edge)] px-4 text-[0.85rem]"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {user.isGuest && (
        <section className="rise">
          <h2 className="text-[1.35rem]">You are browsing as a guest</h2>
          <p className="mt-2 max-w-[40ch] text-[0.95rem] text-[var(--frost-dim)]">
            Everything below is real and yours, but it lives only in this browser. Claim a
            username and it follows you to any device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/login?next=/profile"
              className="press btn-primary inline-flex min-h-14 items-center rounded-full px-6 text-[0.95rem]"
            >
              Claim a username
            </Link>
            <Link
              href="/login?mode=signin&next=/profile"
              className="press hoverable inline-flex min-h-14 items-center rounded-full border border-[var(--edge)] px-6 text-[0.95rem]"
            >
              I have an account
            </Link>
          </div>
        </section>
      )}

      {/* Prose first — a rate means nothing without the span it was measured over. */}
      <section className="rise">
        <h2 className="text-[1.35rem]">The record</h2>
        <p className="mt-3 max-w-[44ch] text-[1rem] leading-relaxed text-[var(--frost-dim)]">
          {stats.total === 0 ? (
            "Nothing logged yet. Scan the code on a blue bin and the first one lands here."
          ) : (
            <>
              Recycling since <strong className="text-[var(--frost)]">{since}</strong> —{" "}
              <strong className="text-[var(--frost)]">{stats.total}</strong> verified{" "}
              {stats.total === 1 ? "action" : "actions"} across{" "}
              <strong className="text-[var(--frost)]">{stats.activeDays}</strong>{" "}
              {stats.activeDays === 1 ? "day" : "days"}, about{" "}
              <strong className="text-[var(--frost)]">{stats.perWeek}</strong> a week.
            </>
          )}
        </p>

        <dl className="mt-6 divide-y divide-[var(--edge)] border-y border-[var(--edge)]">
          <Row label="Current streak" value={`${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}`} accent />
          <Row label="Longest streak" value={`${stats.longestStreak} ${stats.longestStreak === 1 ? "day" : "days"}`} />
          <Row label="This week" value={String(stats.thisWeek)} note={trendNote(trend)} />
          <Row label="Days active" value={`${stats.activeDays} of ${stats.daysSinceStart}`} />
          <Row label="Level" value={`${data.level} · ${data.stage}`} />
          <Row label="Total XP" value={String(data.xp)} />
          <Row label="Groups" value={String(data.groupCount)} />
        </dl>
      </section>

      {stats.materials.length > 0 && (
        <section className="rise">
          <h2 className="text-[1.35rem]">What you bin</h2>
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
            {stats.materials.map((m) => (
              <div
                key={m.material}
                style={{
                  width: `${(m.count / stats.total) * 100}%`,
                  background: MATERIAL_COLOUR[m.material] ?? MATERIAL_COLOUR.other,
                }}
                title={`${m.material}: ${m.count}`}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {stats.materials.map((m) => (
              <li key={m.material} className="flex items-center gap-2.5 text-[0.92rem]">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: MATERIAL_COLOUR[m.material] ?? MATERIAL_COLOUR.other }}
                />
                <span className="capitalize">{m.material}</span>
                <span className="tnum ml-auto text-[var(--frost-dim)]">
                  {m.count} · {Math.round((m.count / stats.total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-[42ch] text-[0.85rem] text-[var(--frost-faint)]">
            Grouped by keyword from what the verifier read in each photo, so an unusual item may
            land in “other”.
          </p>
        </section>
      )}

      <section className="rise flex flex-wrap gap-2.5 border-t border-[var(--edge)] pt-7">
        <Link
          href="/group"
          className="press hoverable min-h-14 rounded-full border border-[var(--edge)] px-6 text-[0.95rem] leading-[3.5rem]"
        >
          Group
        </Link>
        {!user.isGuest && (
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              load();
            }}
            className="press min-h-14 px-2 text-[0.95rem] text-[var(--frost-faint)]"
          >
            Sign out
          </button>
        )}
      </section>

    </div>
  );
}

function trendNote(trend: number): string | undefined {
  if (trend === 0) return undefined;
  return trend > 0 ? `+${trend} on last week` : `${trend} on last week`;
}

function Row({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="text-[0.95rem] text-[var(--frost-dim)]">{label}</dt>
      <dd className="text-right">
        <span
          className={`tnum text-[1.1rem] font-semibold ${
            accent ? "text-[var(--coral)]" : "text-[var(--frost)]"
          }`}
        >
          {value}
        </span>
        {note && <span className="ml-2 text-[0.8rem] text-[var(--frost-faint)]">{note}</span>}
      </dd>
    </div>
  );
}
