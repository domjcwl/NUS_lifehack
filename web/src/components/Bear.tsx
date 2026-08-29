"use client";

import { motion, useReducedMotion } from "motion/react";
import type { BearMood } from "@/lib/types";

/** The bear is lit by the ice, so its tint tracks how much ice is left. */
const FUR: Record<BearMood, string> = {
  thriving: "#eef8fd",
  happy: "#e2f0f7",
  worried: "#c3d4de",
  fading: "#9aacb8",
};

/** Aurora cools and dims as the floe fails — the sky reacts to the state. */
const SKY: Record<BearMood, [string, string]> = {
  thriving: ["#3ad9a6", "#2ba7cd"],
  happy: ["#2ec9a6", "#2ba7cd"],
  worried: ["#2b8fb0", "#5a6fc4"],
  fading: ["#4a5f8a", "#6b5aa8"],
};

const SEA: Record<BearMood, string> = {
  thriving: "#0a2a3a",
  happy: "#0a2635",
  worried: "#07202d",
  fading: "#041520",
};

const STARS = [
  [28, 26], [62, 44], [104, 18], [148, 36], [196, 22],
  [232, 52], [268, 30], [84, 62], [176, 60], [252, 14],
] as const;

export default function Bear({ mood, health }: { mood: BearMood; health: number }) {
  const reduce = useReducedMotion();
  const cx = 150;
  const rx = (68 + (health / 100) * 112) / 2;
  const [a1, a2] = SKY[mood];

  /* A little bounce is earned — the ice recovering is the payoff for logging. */
  const spring = reduce
    ? { duration: 0 }
    : ({ type: "spring", bounce: 0.22, duration: 0.6 } as const);
  const fade = { duration: reduce ? 0 : 0.7 };

  return (
    <svg
      viewBox="0 0 300 210"
      className="w-full max-w-sm"
      role="img"
      aria-label={`Nanuq is ${mood}. The ice floe is at ${health} percent.`}
    >
      <defs>
        <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#03101a" />
          <stop offset="70%" stopColor="#062032" />
          <stop offset="100%" stopColor="#0a2b3d" />
        </linearGradient>

        <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
          <motion.stop offset="0%" animate={{ stopColor: a1 }} transition={fade} stopOpacity="0.9" />
          <motion.stop offset="100%" animate={{ stopColor: a2 }} transition={fade} stopOpacity="0.15" />
        </linearGradient>

        <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#dff2fb" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#dff2fb" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="iceGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#b9e4f6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#b9e4f6" stopOpacity="0" />
        </radialGradient>

        <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>

        <clipPath id="frame">
          <rect width="300" height="210" rx="22" />
        </clipPath>
      </defs>

      <g clipPath="url(#frame)">
        <rect width="300" height="210" fill="url(#night)" />

        {STARS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.3 : 0.9} fill="#dff2fb" opacity={0.55} />
        ))}

        <circle cx="248" cy="42" r="34" fill="url(#moonGlow)" />
        <circle cx="248" cy="42" r="11" fill="#e8f5fb" opacity="0.92" />

        {/* Aurora ribbons — blurred, so they read as light rather than shapes. */}
        <g filter="url(#soft)" opacity="0.85">
          <motion.path
            d="M-20 74 C 50 26, 120 96, 190 48 S 300 34, 330 62 L330 8 L-20 8 Z"
            fill="url(#ribbon)"
            animate={reduce ? {} : { x: [0, 12, 0] }}
            transition={reduce ? {} : { duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M-20 104 C 60 66, 130 126, 210 82 S 310 74, 330 96 L330 40 L-20 40 Z"
            fill="url(#ribbon)"
            opacity="0.5"
            animate={reduce ? {} : { x: [0, -14, 0] }}
            transition={reduce ? {} : { duration: 34, repeat: Infinity, ease: "easeInOut" }}
          />
        </g>

        <motion.rect y="150" width="300" height="60" animate={{ fill: SEA[mood] }} transition={fade} />
        <motion.path
          d="M0 156 Q75 148 150 157 T300 152 V210 H0 Z"
          animate={{ fill: SEA[mood] }}
          transition={fade}
          opacity="0.75"
        />

        {mood === "fading" && (
          <>
            <ellipse cx="46" cy="178" rx="15" ry="4" fill={FUR.fading} opacity="0.5" />
            <ellipse cx="262" cy="188" rx="11" ry="3.5" fill={FUR.fading} opacity="0.42" />
          </>
        )}

        {/* The floe is the light source in this scene. */}
        <motion.ellipse
          cx={cx}
          cy={160}
          ry={40}
          fill="url(#iceGlow)"
          animate={{ rx: rx * 1.9 }}
          transition={spring}
        />
        <motion.ellipse cx={cx} cy={161} ry={15} fill="#7fc3de" animate={{ rx }} transition={spring} />
        <motion.ellipse
          cx={cx}
          cy={155}
          ry={11}
          fill="#dff2fb"
          animate={{ rx: Math.max(0, rx - 7) }}
          transition={spring}
        />

        <g className="bob" style={{ transformOrigin: `${cx}px 138px` }}>
          <motion.g animate={{ fill: FUR[mood] }} transition={fade}>
            <ellipse cx={cx} cy={130} rx={30} ry={20} />
            <ellipse cx={cx - 22} cy={148} rx={8} ry={5} />
            <ellipse cx={cx + 22} cy={148} rx={8} ry={5} />
            <circle cx={cx + 22} cy={111} r={15} />
            <circle cx={cx + 14} cy={99} r={4.5} />
            <circle cx={cx + 30} cy={99} r={4.5} />
          </motion.g>
          <circle cx={cx + 19} cy={109} r={1.9} fill="#04121b" />
          <circle cx={cx + 29} cy={109} r={1.9} fill="#04121b" />
          <ellipse cx={cx + 35} cy={115} rx={4} ry={3} fill="#04121b" opacity="0.9" />
          {(mood === "worried" || mood === "fading") && (
            <path
              d={`M${cx + 15} 104 l6 -3 M${cx + 33} 104 l-6 -3`}
              stroke="#04121b"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.55"
            />
          )}
        </g>
      </g>
    </svg>
  );
}
