"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Bear from "@/components/Bear";

import { BEAR_COPY } from "@/lib/bear";
import type { BearMood, Me } from "@/lib/types";

interface FriendState {
  id: string;
  username: string | null;
  displayName: string;
  streak: number;
  total: number;
  mood: BearMood;
  health: number;
  lastActionAt: number | null;
}

interface SearchHit {
  id: string;
  username: string | null;
  displayName: string;
  added: boolean;
}

export default function FriendsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [mine, setMine] = useState<{ mood: BearMood; health: number; streak: number } | null>(null);
  const [friends, setFriends] = useState<FriendState[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [log, list] = await Promise.all([
      fetch("/api/log").then((r) => r.json()),
      fetch("/api/friends").then((r) => r.json()),
    ]);
    setMe(log.user);
    setMine({ mood: log.mood, health: log.health, streak: log.streak });
    setFriends(list.friends ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Debounced so a fast typist does not fire a request per keystroke. */
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/friends/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setHits(d.results ?? []))
        .catch(() => setHits([]));
    }, 240);
    return () => clearTimeout(t);
  }, [query]);

  async function add(username: string | null) {
    if (!username) return;
    if (me?.isGuest) {
      router.push("/login?next=/friends");
      return;
    }
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error ?? "Could not add that person.");
      return;
    }
    setNotice(`Added @${username}.`);
    setQuery("");
    setHits(null);
    load();
  }

  return (
    <div className="space-y-8">
      {/* Your own bear leads — friends are the comparison, not the subject. */}
      <section className="rise">
        <div className="card card-lg overflow-hidden">
          <Bear mood={mine?.mood ?? "happy"} health={mine?.health ?? 100} />
          <div className="flex items-end justify-between gap-3 px-5 pb-5 pt-4">
            <div>
              <Link href="/profile" className="press inline-block">
                <h1 className="text-[1.6rem] underline decoration-[var(--edge-bright)] decoration-1 underline-offset-4">
                  {me?.isGuest ? "Your bear" : `@${me?.username}`}
                </h1>
              </Link>
              <p className="mt-1 text-[0.92rem] text-[var(--frost-dim)]">
                {mine ? BEAR_COPY[mine.mood].title : "Loading…"}
              </p>
            </div>
            <div className="text-right">
              <p className="tnum text-[2rem] leading-none font-bold text-[var(--coral)]">
                {mine?.streak ?? 0}
              </p>
              <p className="mono mt-1 text-[9px] text-[var(--frost-faint)]">day streak</p>
            </div>
          </div>
        </div>
      </section>

      {me?.isGuest ? (
        <section className="rise">
          <h2 className="text-[1.35rem]">Claim a username to add friends</h2>
          <p className="mt-2 text-[0.95rem] text-[var(--frost-dim)]">
            Your {mine?.streak ?? 0}-day streak comes with you. Friends find you by username, and
            you can sign in on any device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/login?next=/friends"
              className="press btn-primary flex min-h-14 items-center rounded-full px-6 text-[0.95rem]"
            >
              Claim a username
            </Link>
            <Link
              href="/login?mode=signin&next=/friends"
              className="press hoverable inline-flex min-h-14 items-center rounded-full border border-[var(--edge)] px-6 text-[0.95rem]"
            >
              I have an account
            </Link>
          </div>
        </section>
      ) : (
        <section className="rise">
          <h2 className="text-[1.35rem]">Find people</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search for people by username"
            className="mt-3 min-h-14 w-full rounded-full border border-[var(--edge)] bg-[var(--night-2)] px-5 text-base outline-none"
          />

          {hits !== null && (
            <ul className="mt-3 divide-y divide-[var(--edge)]">
              {hits.length === 0 ? (
                <li className="py-4 text-[0.92rem] text-[var(--frost-dim)]">
                  Nobody matches “{query}”.
                </li>
              ) : (
                hits.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate">@{h.username}</p>
                      <p className="text-[0.8rem] text-[var(--frost-faint)]">{h.displayName}</p>
                    </div>
                    <button
                      onClick={() => add(h.username)}
                      disabled={h.added}
                      className="press hoverable min-h-11 shrink-0 rounded-full border border-[var(--edge)] px-4 text-[0.85rem] disabled:opacity-40"
                    >
                      {h.added ? "Added" : "Add"}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {notice && <p className="mt-3 text-[0.85rem] text-[var(--aurora-1)]">{notice}</p>}
        </section>
      )}

      <section className="rise">
        <h2 className="text-[1.35rem]">
          {friends.length > 0 ? `${friends.length} friend${friends.length > 1 ? "s" : ""}` : "No friends yet"}
        </h2>

        {friends.length === 0 ? (
          <p className="mt-2 max-w-[40ch] text-[0.95rem] text-[var(--frost-dim)]">
            Nobody keeps a streak alone. Add someone and their floe sits next to yours — thinning
            when they slip, solid when they do not.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {friends.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/friends/${f.id}`}
                  className="card press flex items-center gap-4 px-4 py-3.5"
                >
                <div className="w-20 shrink-0">
                  <Bear mood={f.mood} health={f.health} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate">@{f.username}</p>
                  <p className="text-[0.8rem] text-[var(--frost-dim)]">
                    {BEAR_COPY[f.mood].title}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[1.35rem] leading-none font-bold">{f.streak}</p>
                  <p className="mono mt-1 text-[9px] text-[var(--frost-faint)]">days</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/profile"
        className="press hoverable inline-flex min-h-14 items-center rounded-full border border-[var(--edge)] px-6 text-[0.95rem]"
      >
        Your profile and stats
      </Link>

    </div>
  );
}
