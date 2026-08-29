import Link from "next/link";
import { notFound } from "next/navigation";
import { FRIENDS } from "@/lib/friends";

export default async function FriendPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const friend = FRIENDS.find((item) => item.id === id);

  if (!friend) {
    notFound();
  }

  const xpPercent = (friend.xp / friend.xpMax) * 100;

  return (
    <div className="stagger space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="mono text-[10px] text-[var(--ink-soft)]">Friend</p>
          <h1 className="mt-1 text-[1.7rem] font-semibold">{friend.name}</h1>
        </div>
        <Link href="/friends" className="press rounded-full bg-[var(--deep)] px-3 py-2 text-sm text-white">
          Back
        </Link>
      </header>

      <section className="card card-lg px-5 py-5 text-center">
        <div
          className="mx-auto flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/60 shadow-inner shadow-white/40"
          style={{
            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.9), ${friend.color} 26%, ${friend.accent} 100%)`,
          }}
        >
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.7rem] bg-white/20 backdrop-blur-sm">
            <div className="absolute left-3 top-4 h-3 w-3 rounded-full bg-white/90" />
            <div className="absolute right-3 top-4 h-3 w-3 rounded-full bg-white/90" />
            <div className="absolute bottom-4 h-3 w-9 rounded-full border-2 border-white/90" />
            <div className="h-14 w-14 rounded-[1.3rem] bg-white/15" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <h2 className="text-xl font-semibold">{friend.petName}</h2>
          <span className="rounded-full bg-[var(--sea)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--sea)]">
            Lv {friend.level}
          </span>
        </div>

        <div className="mx-auto mt-3 w-full max-w-xs">
          <div className="flex items-center justify-between text-[10px] font-medium text-[var(--ink-soft)]">
            <span>XP</span>
            <span>{friend.xp}/{friend.xpMax}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--ice-1)]">
            <div className="h-full rounded-full bg-[var(--sea)]" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>

        <p className="mt-3 text-sm text-[var(--ink-soft)]">{friend.petMood} · {friend.status}</p>
        <p className="mt-3 text-sm text-[var(--ink-soft)]">{friend.trait}</p>
      </section>
    </div>
  );
}
