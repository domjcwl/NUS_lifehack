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
 */
export default function Bear({ mood, health }: { mood: BearMood; health: number }) {
  const floe = 70 + (health / 100) * 110;
  const cx = 150;

  return (
    <svg viewBox="0 0 300 210" className="w-full max-w-xs" role="img" aria-label={`Nanuq is ${mood}`}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf2f6" />
          <stop offset="100%" stopColor="#cfe0e9" />
        </linearGradient>
      </defs>

      <rect width="300" height="210" rx="18" fill="url(#sky)" />
      <circle cx="245" cy="45" r="17" fill="#f6e7c8" opacity="0.85" />

      <path d={`M0 158 Q75 ${148} 150 158 T300 158 V210 H0 Z`} fill={WATER[mood]} opacity="0.9" />
      <path d={`M0 170 Q75 ${162} 150 172 T300 168 V210 H0 Z`} fill={WATER[mood]} opacity="0.55" />

      {mood === "fading" && (
        <>
          <ellipse cx="52" cy="176" rx="17" ry="5" fill={TINT[mood]} opacity="0.7" />
          <ellipse cx="256" cy="184" rx="12" ry="4" fill={TINT[mood]} opacity="0.6" />
        </>
      )}

      <ellipse cx={cx} cy={160} rx={floe / 2} ry={16} fill={TINT[mood]} />
      <ellipse cx={cx} cy={155} rx={floe / 2 - 6} ry={11} fill="#ffffff" opacity="0.75" />

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
          <path d={`M${cx + 15} 105 l6 -3 M${cx + 33} 105 l-6 -3`} stroke="#10202b" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
        )}
      </g>
    </svg>
  );
}
