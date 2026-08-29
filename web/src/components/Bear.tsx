"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
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
  const rx = (70 + (health / 100) * 110) / 2;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [launch, setLaunch] = useState({ x: 0, y: 0, kind: "idle" as "idle" | "launch" | "splash" });
  const dragStart = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  /* A little bounce is earned — the ice recovering is the payoff for logging. */
  const spring = reduce
    ? { duration: 0 }
    : ({ type: "spring", bounce: 0.2, duration: 0.55 } as const);

  function handlePointerDown(event: React.PointerEvent<SVGGElement>) {
    if (reduce) return;

    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGGElement>) {
    if (!dragging || !dragStart.current) return;

    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;

    setOffset({
      x: Math.max(-120, Math.min(120, dragStart.current.originX + dx)),
      y: Math.max(-80, Math.min(80, dragStart.current.originY + dy)),
    });
  }

  function handlePointerUp(event: React.PointerEvent<SVGGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const currentY = dragStart.current ? dragStart.current.originY + (event.clientY - dragStart.current.y) : 0;
    const releaseKind = currentY < -28 ? "launch" : currentY > 28 ? "splash" : "idle";

    if (releaseKind === "launch") {
      setLaunch({ x: offset.x * 0.3, y: -180, kind: "launch" });
      setOffset({ x: offset.x * 0.25, y: -160 });
    } else if (releaseKind === "splash") {
      setLaunch({ x: 0, y: 35, kind: "splash" });
      setOffset({ x: 0, y: 30 });
    } else {
      setLaunch({ x: 0, y: 0, kind: "idle" });
      setOffset({ x: 0, y: 0 });
    }

    dragStart.current = null;
    setDragging(false);

    window.setTimeout(() => {
      setLaunch({ x: 0, y: 0, kind: "idle" });
      setOffset({ x: 0, y: 0 });
    }, releaseKind === "launch" ? 580 : 320);
  }

  const dragRotation = dragging ? (offset.x / 140) * 8 : 0;
  const draggableY = launch.kind === "launch" ? launch.y : offset.y;
  const draggableX = launch.kind === "launch" ? launch.x : offset.x;

  return (
    <svg
      viewBox="0 0 300 210"
      className="block w-full max-w-xs"
      role="img"
      aria-label={`Nanuq is ${mood}`}
    >
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

        <g>
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
          {launch.kind === "splash" && (
            <>
              <motion.circle cx="75" cy="182" r="7" initial={{ opacity: 0.9, scale: 0.4 }} animate={{ opacity: 0, scale: 2.2 }} transition={{ duration: 0.32 }} fill="#dff6ff" />
              <motion.circle cx="120" cy="186" r="9" initial={{ opacity: 0.8, scale: 0.5 }} animate={{ opacity: 0, scale: 2.5 }} transition={{ duration: 0.38, delay: 0.05 }} fill="#dff6ff" />
              <motion.circle cx="170" cy="180" r="8" initial={{ opacity: 0.85, scale: 0.5 }} animate={{ opacity: 0, scale: 2.3 }} transition={{ duration: 0.36, delay: 0.08 }} fill="#dff6ff" />
              <motion.circle cx="50" cy="175" r="4" initial={{ opacity: 1, x: 0, y: 0 }} animate={{ opacity: 0, x: -35, y: -28 }} transition={{ duration: 0.5, ease: "easeOut" }} fill="#b3e5fc" />
              <motion.circle cx="100" cy="178" r="3.5" initial={{ opacity: 1, x: 0, y: 0 }} animate={{ opacity: 0, x: -22, y: -35 }} transition={{ duration: 0.52, delay: 0.04, ease: "easeOut" }} fill="#b3e5fc" />
              <motion.circle cx="200" cy="176" r="4.5" initial={{ opacity: 1, x: 0, y: 0 }} animate={{ opacity: 0, x: 28, y: -32 }} transition={{ duration: 0.48, delay: 0.06, ease: "easeOut" }} fill="#b3e5fc" />
              <motion.circle cx="240" cy="180" r="3" initial={{ opacity: 1, x: 0, y: 0 }} animate={{ opacity: 0, x: 45, y: -24 }} transition={{ duration: 0.54, delay: 0.03, ease: "easeOut" }} fill="#b3e5fc" />
              <motion.circle cx="130" cy="184" r="3.8" initial={{ opacity: 1, x: 0, y: 0 }} animate={{ opacity: 0, x: 8, y: -38 }} transition={{ duration: 0.5, delay: 0.05, ease: "easeOut" }} fill="#b3e5fc" />
            </>
          )}
        </g>

        <motion.g
          animate={launch.kind === "launch" ? { x: draggableX, y: 0 } : { x: draggableX, y: draggableY, rotate: dragRotation }}
          transition={
            launch.kind === "launch"
              ? { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
              : dragging
              ? { type: "spring", stiffness: 420, damping: 26 }
              : { type: "spring", stiffness: 180, damping: 18 }
          }
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="cursor-grab active:cursor-grabbing"
        >
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
        </motion.g>
      </svg>
  );
}
