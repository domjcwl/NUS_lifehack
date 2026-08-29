"use client";

import { motion, useReducedMotion } from "motion/react";
import type { BearMood } from "@/lib/types";

const TINT: Record<BearMood, string> = {
  thriving: "#ffffff",
  happy: "#fbfcfd",
  worried: "#f0eee9",
  fading: "#e6e1d8",
};

const WATER: Record<BearMood, string> = {
  thriving: "#1d7a99",
  happy: "#1d7a99",
  worried: "#17607a",
  fading: "#0d3b52",
};

/**
 * The floe width tracks health directly — the loss is visible, which is the
 * whole mechanic. A number on a dashboard would not do this work.
 *
 * Health changes are sprung rather than cut: the ice growing back is the
 * payoff for logging, so it should read as a physical thing settling, not a
 * value snapping to a new number.
 */
export default function Bear({ mood, health }: { mood: BearMood; health: number }) {
  const reduce = useReducedMotion();
  const cx = 150;
  const rx = (70 + (health / 100) * 110) / 2;

  /* A little bounce is earned here — the ice is recovering, not just updating. */
  const spring = reduce
    ? { duration: 0 }
    : ({ type: "spring", bounce: 0.2, duration: 0.55 } as const);

  return (
    <svg viewBox="0 0 300 210" className="w-full max-w-xs" role="img" aria-label={`Nanuq is ${mood}`}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcecf3" />
          <stop offset="55%" stopColor="#e9f2f6" />
          <stop offset="100%" stopColor="#f6efe2" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#f9e9c6" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#f9e9c6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="300" height="210" rx="18" fill="url(#sky)" />
      <circle cx="245" cy="48" r="46" fill="url(#sun)" />
      <circle cx="245" cy="48" r="15" fill="#f7e3ba" opacity="0.9" />

      <motion.path
        d="M0 158 Q75 148 150 158 T300 158 V210 H0 Z"
        animate={{ fill: WATER[mood] }}
        transition={{ duration: reduce ? 0 : 0.45 }}
        opacity={0.9}
      />
      <motion.path
        d="M0 170 Q75 162 150 172 T300 168 V210 H0 Z"
        animate={{ fill: WATER[mood] }}
        transition={{ duration: reduce ? 0 : 0.45 }}
        opacity={0.55}
      />

      {mood === "fading" && (
        <>
          <ellipse cx="52" cy="176" rx="17" ry="5" fill={TINT[mood]} opacity="0.7" />
          <ellipse cx="256" cy="184" rx="12" ry="4" fill={TINT[mood]} opacity="0.6" />
        </>
      )}

      <motion.ellipse cx={cx} cy={160} ry={16} fill={TINT[mood]} animate={{ rx }} transition={spring} />
      <motion.ellipse
        cx={cx}
        cy={155}
        ry={11}
        fill="#ffffff"
        opacity={0.75}
        animate={{ rx: Math.max(0, rx - 6) }}
        transition={spring}
      />

      <g className="bob" style={{ transformOrigin: `${cx}px 140px` }}>
        <ellipse cx={cx} cy={131} rx={30} ry={20} fill={TINT[mood]} />
        <ellipse cx={cx - 22} cy={149} rx={8} ry={5} fill={TINT[mood]} />
        <ellipse cx={cx + 22} cy={149} rx={8} ry={5} fill={TINT[mood]} />
        <circle cx={cx + 22} cy={112} r={15} fill={TINT[mood]} />
        <circle cx={cx + 14} cy={100} r={4.5} fill={TINT[mood]} />
        <circle cx={cx + 30} cy={100} r={4.5} fill={TINT[mood]} />
        <circle cx={cx + 19} cy={110} r={1.9} fill="#10202b" />
        <circle cx={cx + 29} cy={110} r={1.9} fill="#10202b" />
        <ellipse cx={cx + 35} cy={116} rx={4} ry={3} fill="#10202b" opacity="0.85" />
        {(mood === "worried" || mood === "fading") && (
          <path
            d={`M${cx + 15} 105 l6 -3 M${cx + 33} 105 l-6 -3`}
            stroke="#10202b"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.6"
          />
        )}
      </g>
    </svg>
  );
}
