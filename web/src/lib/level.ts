/**
 * Points and levels.
 *
 * The brief warns against "a badge stuck on a dashboard", so points here are
 * not the reward — the bear is. Every point spent goes into the animal getting
 * visibly bigger and stronger, which is why `scaleFor` lives next to the
 * thresholds rather than in the component: growth is part of the rule, not a
 * decoration applied afterwards.
 */

export const POINTS = {
  /** A verified action at a bin. */
  verified: 10,
  /** Bonus when the item went into the right stream, not just any bin. */
  correctStream: 5,
  /** Every seventh consecutive day. Rewards the run, not the volume. */
  streakWeek: 25,
} as const;

export type PointReason = keyof typeof POINTS;

export const REASON_LABEL: Record<PointReason, string> = {
  verified: "Verified at the bin",
  correctStream: "Right stream",
  streakWeek: "A week unbroken",
};

/**
 * Cumulative XP at which each level begins. Gaps widen, so early levels arrive
 * quickly enough to be felt in a demo and later ones stay meaningful.
 */
const THRESHOLDS = [0, 60, 160, 320, 560, 900, 1360, 1960, 2720, 3660, 4800];

export const MAX_LEVEL = THRESHOLDS.length;

export function levelFor(xp: number): number {
  let level = 1;
  for (let i = 0; i < THRESHOLDS.length; i += 1) {
    if (xp >= THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

/** XP at which the current level started, and at which the next one begins. */
export function levelBounds(xp: number): { start: number; next: number | null } {
  const level = levelFor(xp);
  return {
    start: THRESHOLDS[level - 1],
    next: level >= MAX_LEVEL ? null : THRESHOLDS[level],
  };
}

/** 0–1 progress through the current level. 1 when maxed. */
export function levelProgress(xp: number): number {
  const { start, next } = levelBounds(xp);
  if (next === null) return 1;
  return Math.max(0, Math.min(1, (xp - start) / (next - start)));
}

/**
 * How much bigger the bear is drawn at this level. A cub at level 1 and a full
 * adult by the top — enough to notice between levels without the animal
 * outgrowing its own scene.
 */
export function scaleFor(level: number): number {
  const t = (Math.min(level, MAX_LEVEL) - 1) / (MAX_LEVEL - 1);
  return 0.78 + t * 0.42;
}

/** Cub, then bear. The name follows the growth so the level means something. */
export function stageFor(level: number): string {
  if (level <= 2) return "cub";
  if (level <= 5) return "young bear";
  if (level <= 8) return "bear";
  return "great bear";
}
