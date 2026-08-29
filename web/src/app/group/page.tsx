"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Bear from "@/components/Bear";
import { BEAR_COPY } from "@/lib/bear";
import type { BearMood, Me } from "@/lib/types";

interface Member {
  id: string;
  username: string | null;
  displayName: string;
  isYou: boolean;
  streak: number;
  total: number;
  mood: BearMood;
  health: number;
  xp: number;
  level: number;
  stage: string;
}

interface Group {
  id: string;
  name: string;
  inviteCode: string;
  creatorId: string;
  memberCount: number;
  members: Member[];
}

export default function GroupPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [log, list] = await Promise.all([
      fetch("/api/log").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
    ]);
    setMe(log.user);
    setGroups(list.groups ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That did not work.");
      setName("");
      setCode("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (me?.isGuest) {
    return (
      <div className="space-y-6">
        <h1 className="text-title">Recycle together</h1>
        <p className="max-w-[38ch] text-body leading-relaxed text-[var(--frost-dim)]">
          A group is your block, your flat or your family. Everyone keeps their own bear, and
          you can see whose ice is holding.
        </p>
        <Link
          href="/login?next=/group"
          className="press btn-primary inline-flex min-h-14 items-center rounded-full px-6 text-body"
        >
          Claim a username first
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      <header className="rise">
        <h1 className="text-title">
          {groups.length > 0 ? "Your group" : "Recycle together"}
        </h1>
        {groups.length === 0 && (
          <p className="mt-2 max-w-[38ch] text-body leading-relaxed text-[var(--frost-dim)]">
            A group is your block, your flat or your family. Everyone keeps their own bear —
            the group is where you see whose ice is holding.
          </p>
        )}
      </header>

      {groups.map((g) => (
        <section key={g.id} className="rise">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-head">{g.name}</h2>
            <span className="text-meta text-[var(--frost-faint)]">
              {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
            </span>
          </div>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(g.inviteCode).catch(() => undefined);
              setCopied(g.id);
              setTimeout(() => setCopied(null), 1800);
            }}
            className="press hoverable mt-3 flex min-h-14 w-full items-center justify-between rounded-2xl border border-[var(--edge)] px-4"
          >
            <span className="text-body text-[var(--frost-dim)]">Invite code</span>
            <span className="mono text-sub tracking-[0.22em] text-[var(--frost)]">
              {copied === g.id ? "COPIED" : g.inviteCode}
            </span>
          </button>

          <ul className="mt-5 space-y-3">
            {[...g.members]
              .sort((a, b) => b.streak - a.streak || b.xp - a.xp)
              .map((m) => (
                <li key={m.id} className="card pad-tight flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <Bear mood={m.mood} health={m.health} level={m.level} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      @{m.username}
                      {m.isYou && <span className="text-[var(--frost-faint)]"> · you</span>}
                    </p>
                    <p className="text-meta text-[var(--frost-dim)]">
                      {BEAR_COPY[m.mood].title}
                    </p>
                    <p className="mono mt-1 text-label text-[var(--frost-faint)]">
                      {m.stage} · level {m.level}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-head leading-none font-bold text-[var(--coral)]">
                      {m.streak}
                    </p>
                    <p className="mono mt-1 text-label text-[var(--frost-faint)]">days</p>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="rise space-y-6 border-t border-[var(--edge)] pt-7">
        <div>
          <h2 className="text-sub">Join with a code</h2>
          <div className="mt-3 flex gap-2.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Group invite code"
              className="mono min-h-14 flex-1 rounded-2xl border border-[var(--edge)] bg-[var(--night-2)] px-4 text-body tracking-[0.2em] outline-none"
            />
            <button
              onClick={() => post({ code })}
              disabled={busy || code.length < 4}
              className="press hoverable min-h-14 shrink-0 rounded-full border border-[var(--edge)] px-6 text-body disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-sub">Or start one</h2>
          <div className="mt-3 flex gap-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Blk 826A"
              aria-label="New group name"
              className="min-h-14 flex-1 rounded-2xl border border-[var(--edge)] bg-[var(--night-2)] px-4 text-body outline-none"
            />
            <button
              onClick={() => post({ name })}
              disabled={busy || name.trim().length < 2}
              className="press btn-primary min-h-14 shrink-0 rounded-full px-6 text-body disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-body text-[var(--coral)]">
            {error}
          </p>
        )}
      </section>

      <Link
        href="/profile"
        className="press hoverable inline-flex min-h-14 items-center rounded-full border border-[var(--edge)] px-6 text-body"
      >
        Your profile and stats
      </Link>
    </div>
  );
}
