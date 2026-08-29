"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import Bear from "@/components/Bear";
import { BEAR_COPY } from "@/lib/bear";
import type { BearMood } from "@/lib/types";

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

export default function FriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [friend, setFriend] = useState<FriendState | null | "missing">(null);

  useEffect(() => {
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d: { friends: FriendState[] }) => {
        setFriend(d.friends.find((f) => f.id === id) ?? "missing");
      })
      .catch(() => setFriend("missing"));
  }, [id]);

  if (friend === null) {
    return <div className="card card-lg h-80 animate-pulse opacity-50" />;
  }

  if (friend === "missing") {
    return (
      <div className="space-y-4">
        <h1 className="text-[1.6rem]">Not one of your friends</h1>
        <p className="text-[0.95rem] text-[var(--frost-dim)]">
          You can only see the floe of someone you have added.
        </p>
        <Link
          href="/friends"
          className="press btn-primary inline-flex min-h-14 items-center rounded-full px-6 text-[0.95rem]"
        >
          Back to friends
        </Link>
      </div>
    );
  }

  const copy = BEAR_COPY[friend.mood];
  const days =
    friend.lastActionAt === null
      ? null
      : Math.floor((Date.now() - friend.lastActionAt) / 86_400_000);

  return (
    <div className="stagger space-y-6">
      <Link href="/friends" className="press mono inline-block text-[10px] text-[var(--frost-dim)]">
        Back to friends
      </Link>

      <section className="card card-lg overflow-hidden">
        <Bear mood={friend.mood} health={friend.health} />
        <div className="px-5 pb-5 pt-4">
          <h1 className="text-[2rem]">@{friend.username}</h1>
          <p className="mt-1.5 text-[0.98rem] text-[var(--frost-dim)]">{copy.title}</p>
        </div>
        <div className="grid grid-cols-3 border-t border-[var(--edge)]">
          <Cell label="Streak" value={String(friend.streak)} unit="days" accent />
          <Cell label="Verified" value={String(friend.total)} unit="actions" divider />
          <Cell
            label="Last seen"
            value={days === null ? "—" : days === 0 ? "today" : `${days}d`}
            unit={days === null ? "never" : "ago"}
            divider
          />
        </div>
      </section>

      <p className="max-w-[40ch] text-[0.95rem] text-[var(--frost-dim)]">
        You can see their floe, not their bins. Nothing about where they live or what they threw
        away is shared — only whether the ice is holding.
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  unit,
  accent,
  divider,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  divider?: boolean;
}) {
  return (
    <div className={`px-3 py-4 ${divider ? "border-l border-[var(--edge)]" : ""}`}>
      <p
        className={`tnum text-[1.6rem] leading-none font-bold ${
          accent ? "text-[var(--coral)]" : "text-[var(--frost)]"
        }`}
      >
        {value}
      </p>
      <p className="mono mt-1.5 text-[9px] text-[var(--frost-faint)]">{label}</p>
      <p className="mt-0.5 text-[10px] text-[var(--frost-faint)]">{unit}</p>
    </div>
  );
}
