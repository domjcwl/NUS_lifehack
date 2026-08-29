"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Bear from "@/components/Bear";
import { FRIENDS } from "@/lib/friends";
import type { BearMood } from "@/lib/types";

const EMPTY_PET = { mood: "happy" as BearMood, health: 100 };
const USER_LEVEL = 1;
const USER_XP = 0;
const USER_XP_MAX = 100;

export default function FriendsPage() {
  const [userPet, setUserPet] = useState(EMPTY_PET);

  useEffect(() => {
    fetch("/api/log")
      .then((r) => r.json())
      .then((data) => {
        if (data?.mood && data?.health !== undefined) {
          setUserPet({ mood: data.mood, health: data.health });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="stagger space-y-5">
      <header>
        <p className="mono text-[10px] text-[var(--ink-soft)]">Your circle</p>
        <h1 className="mt-1 text-[1.7rem] font-semibold">Pet & friends</h1>
      </header>

      <section className="card card-lg px-5 py-5">
        <div className="flex flex-col items-center text-center">
          <div className="mx-auto flex w-full justify-center">
            <div className="w-full max-w-[19rem]">
              <Bear mood={userPet.mood} health={userPet.health} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <h2 className="text-xl font-semibold">Nanuq</h2>
            <span className="rounded-full bg-[var(--sea)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--sea)]">
              Lv {USER_LEVEL}
            </span>
          </div>

          <div className="mt-3 w-full max-w-xs">
            <div className="flex items-center justify-between text-[10px] font-medium text-[var(--ink-soft)]">
              <span>XP</span>
              <span>{USER_XP}/{USER_XP_MAX}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--ice-1)]">
              <div
                className="h-full rounded-full bg-[var(--sea)]"
                style={{ width: `${(USER_XP / USER_XP_MAX) * 100}%` }}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">Your polar bear companion</p>
        </div>
      </section>

      <section className="card px-4 py-4">
        <p className="mono text-[10px] text-[var(--ink-soft)]">Friends</p>
        <ul className="mt-3 space-y-2">
          {FRIENDS.map((friend) => (
            <li key={friend.id}>
              <Link
                href={`/friends/${friend.id}`}
                className="press flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--edge)] bg-white/40 px-3 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${friend.color}, ${friend.accent})`,
                    }}
                  >
                    <span className="text-xl">🐾</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{friend.petName}</p>
                      <span className="rounded-full bg-[var(--gold)]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--gold)]">
                        Lv {friend.level}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-soft)]">{friend.name}</p>
                  </div>
                </div>
                <span className="text-sm text-[var(--ink-soft)]">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
