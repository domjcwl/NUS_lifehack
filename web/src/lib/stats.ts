import type { ActionRow } from "./repo";

const DAY = 86_400_000;

export interface Stats {
  total: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  thisWeek: number;
  lastWeek: number;
  perWeek: number;
  firstActionAt: number | null;
  lastActionAt: number | null;
  /** Days since the first action, so a rate has a denominator. */
  daysSinceStart: number;
  materials: { material: string; count: number }[];
}

/** Blunt keyword match — the same one the Learn screen uses. */
export function materialOf(item: string): string {
  const t = item.toLowerCase();
  if (/bottle|tub|container|cup|plastic|pet/.test(t)) return "plastic";
  if (/card|paper|box|carton|sleeve|newspaper/.test(t)) return "paper";
  if (/can|tin|foil|aluminium|aluminum|metal/.test(t)) return "metal";
  if (/glass|jar/.test(t)) return "glass";
  return "other";
}

function dayIndex(t: number): number {
  return Math.floor(t / DAY);
}

/** The longest run of consecutive days that ever contained an action. */
export function longestStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
  const days = [...new Set(timestamps.map(dayIndex))].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export function computeStats(actions: ActionRow[], now = Date.now()): Stats {
  const times = actions.map((a) => a.at);
  const activeDays = new Set(times.map(dayIndex)).size;
  const first = times.length ? Math.min(...times) : null;
  const last = times.length ? Math.max(...times) : null;

  const thisWeek = times.filter((t) => now - t < 7 * DAY).length;
  const lastWeek = times.filter((t) => now - t >= 7 * DAY && now - t < 14 * DAY).length;

  /* Rate needs a denominator of at least one week, or a two-day-old account
     reports an absurd weekly figure. */
  const spanDays = first === null ? 0 : Math.max(7, Math.ceil((now - first) / DAY));
  const perWeek = first === null ? 0 : (times.length / spanDays) * 7;

  const counts = new Map<string, number>();
  actions.forEach((a) => {
    const m = materialOf(a.item);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  });

  return {
    total: actions.length,
    currentStreak: 0, // filled by the caller, which owns the forgiveness rule
    longestStreak: longestStreak(times),
    activeDays,
    thisWeek,
    lastWeek,
    perWeek: Math.round(perWeek * 10) / 10,
    firstActionAt: first,
    lastActionAt: last,
    daysSinceStart: first === null ? 0 : Math.max(1, Math.ceil((now - first) / DAY)),
    materials: [...counts.entries()]
      .map(([material, count]) => ({ material, count }))
      .sort((a, b) => b.count - a.count),
  };
}
