import type { BearMood } from "./types";

const DAY = 86_400_000;

/**
 * The bear is a loss-aversion device, not a reward badge. It degrades with
 * time since the last verified action, so the user is protecting something
 * rather than collecting something.
 */
export function bearMood(lastActionAt: number | null, now = Date.now()): BearMood {
  if (lastActionAt === null) return "worried";
  const days = (now - lastActionAt) / DAY;
  if (days < 1) return "thriving";
  if (days < 2) return "happy";
  if (days < 4) return "worried";
  return "fading";
}

/** Health drives the ice floe size in the UI. 100 = full floe. */
export function bearHealth(lastActionAt: number | null, now = Date.now()): number {
  if (lastActionAt === null) return 55;
  const days = (now - lastActionAt) / DAY;
  return Math.max(10, Math.round(100 - days * 22));
}

export function streakFrom(timestamps: number[], now = Date.now()): number {
  if (timestamps.length === 0) return 0;
  const days = new Set(timestamps.map((t) => Math.floor(t / DAY)));
  let streak = 0;
  let cursor = Math.floor(now / DAY);
  // Today not yet logged is not a broken streak — start from yesterday.
  if (!days.has(cursor)) cursor -= 1;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

export const BEAR_COPY: Record<BearMood, { title: string; line: string }> = {
  thriving: { title: "Nanuq is thriving", line: "The floe is solid. Keep it that way." },
  happy: { title: "Nanuq is doing well", line: "One more today keeps the ice firm." },
  worried: { title: "Nanuq is uneasy", line: "The floe is thinning. A single sort fixes it." },
  fading: { title: "Nanuq is losing ground", line: "The ice is breaking up. Log something today." },
};
