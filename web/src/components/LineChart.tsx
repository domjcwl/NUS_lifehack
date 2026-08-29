"use client";

import { useId, useState } from "react";

export interface Series {
  label: string;
  values: number[];
  /** The emphasised series carries the accent; context series stay gray. */
  emphasis?: boolean;
}

interface Props {
  series: Series[];
  ticks: string[];
  /** Formats a value for tooltips and direct labels. */
  format?: (v: number) => string;
  yMax?: number;
  caption?: string;
}

/* Validated against the dark surface: L 0.523 (inside the 0.48–0.67 band), >=3:1. */
const ACCENT = "#1baf7a";
const CONTEXT = "#61798a";

const W = 320;
const H = 150;
const PAD = { top: 14, right: 40, bottom: 24, left: 30 };

/**
 * Emphasis form, not categorical: one series is the point and the rest are
 * context, so the accent goes to the arm that matters and the other stays gray.
 * Trend over time is a line — bars would make the reader compare heights when
 * the question is direction.
 */
export default function LineChart({ series, ticks, format = String, yMax, caption }: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  const max = yMax ?? Math.max(...series.flatMap((s) => s.values)) * 1.15;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const n = ticks.length;

  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const gridlines = [0, 0.5, 1];

  return (
    <figure className="m-0">
      {/* Identity is never colour alone — the legend names both series. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: s.emphasis ? ACCENT : CONTEXT }}
            />
            <span className="mono text-label text-[var(--frost-dim)]">{s.label}</span>
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label={caption ?? "Line chart"}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PAD.left) / plotW) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        {/* Solid hairlines one shade off the surface — never dashed. */}
        {gridlines.map((g) => (
          <line
            key={g}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + plotH * g}
            y2={PAD.top + plotH * g}
            stroke="var(--edge)"
            strokeWidth="1"
          />
        ))}

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--edge-bright)"
            strokeWidth="1"
          />
        )}

        {ticks.map((t, i) => (
          <text
            key={t}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            className="mono"
            fontSize="8"
            fill="var(--frost-faint)"
          >
            {t}
          </text>
        ))}

        {series.map((s) => {
          const colour = s.emphasis ? ACCENT : CONTEXT;
          return (
            <g key={s.label}>
              <polyline
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke={colour}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s.emphasis ? 1 : 0.7}
              />
              {/* Direct-label the endpoint only — a number on every point is chaos. */}
              <circle
                cx={x(s.values.length - 1)}
                cy={y(s.values[s.values.length - 1])}
                r="4.5"
                fill={colour}
                stroke="var(--night-1)"
                strokeWidth="2"
              />
              <text
                x={x(s.values.length - 1) + 9}
                y={y(s.values[s.values.length - 1]) + 3}
                className="mono"
                fontSize="9"
                fill={s.emphasis ? "var(--frost)" : "var(--frost-faint)"}
              >
                {format(s.values[s.values.length - 1])}
              </text>
            </g>
          );
        })}

        {hover !== null &&
          series.map((s) => (
            <circle
              key={`h${s.label}`}
              cx={x(hover)}
              cy={y(s.values[hover])}
              r="4"
              fill={s.emphasis ? ACCENT : CONTEXT}
              stroke="var(--night-1)"
              strokeWidth="2"
            />
          ))}
      </svg>

      {/* Tooltip lives outside the SVG so it inherits real text styling. */}
      <div className="mt-2 min-h-[1.35rem]" aria-live="polite">
        {hover !== null && (
          <p className="mono text-label text-[var(--frost-dim)]">
            {ticks[hover]}
            {series.map((s) => (
              <span key={s.label} className="ml-3">
                <span style={{ color: s.emphasis ? ACCENT : CONTEXT }}>●</span>{" "}
                {format(s.values[hover])}
              </span>
            ))}
          </p>
        )}
      </div>

      <figcaption id={id} className="sr-only">
        {caption}
      </figcaption>
    </figure>
  );
}
