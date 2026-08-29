"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

/**
 * Prototype surface only. Nothing here is imported by production code.
 * Content is real product copy — the same facts each variant must carry.
 */

export interface Fact {
  tag: string;
  belief: string;
  title: string;
  body: string;
  figure?: string;
  figureLabel?: string;
}

export const FACTS: Fact[] = [
  {
    tag: "Contamination",
    belief: "A bit of sauce left in the tub is fine.",
    title: "Rinse it, or the whole bag goes",
    body: "One unrinsed container can contaminate everything around it. The bag stops being recycling and becomes waste at the sorting facility.",
    figure: "1",
    figureLabel: "dirty item spoils a bag",
  },
  {
    tag: "Plastics",
    belief: "Plastic is plastic — it all goes in the blue bin.",
    title: "Soft plastics are not accepted",
    body: "Bags, wrappers and cling film jam the machinery at materials recovery facilities. They belong in general waste unless there is a dedicated collection point.",
    figure: "0",
    figureLabel: "soft plastics accepted",
  },
  {
    tag: "Bubble tea",
    belief: "The whole cup is recyclable.",
    title: "A bubble tea cup is two materials",
    body: "The cup itself recycles once rinsed. The sealed film and the straw do not. Separating them takes about four seconds.",
    figure: "4s",
    figureLabel: "to separate them",
  },
  {
    tag: "Blue bins",
    belief: "You have to sort paper from plastic first.",
    title: "Blue bins take it all together",
    body: "Singapore's blue commingled bins accept plastic, paper, metal and glass in the same opening. Sorting happens downstream, not at your block.",
    figure: "4",
    figureLabel: "materials, one bin",
  },
  {
    tag: "Food waste",
    belief: "Cardboard always recycles.",
    title: "Grease is the dividing line",
    body: "The greasy base of a pizza box is general waste; the clean lid recycles. Tear it in half rather than binning the whole thing either way.",
    figure: "½",
    figureLabel: "the box, not all of it",
  },
];

/* ────────────────────────────────────────────────────────────────
   VARIANT 1 — Field Guide
   Axis: structure as reference. No cards at all. A numbered index and
   typographic hierarchy carry it, the way an almanac would.
   ──────────────────────────────────────────────────────────────── */
export function FieldGuide() {
  return (
    <div className="stagger">
      <header className="mb-8">
        <p className="mono text-[10px] text-[var(--frost-faint)]">Field guide</p>
        <h1 className="mt-2 text-[2.4rem] leading-[0.95]">
          What actually
          <br />
          goes in the bin
        </h1>
        <p className="mt-3 max-w-[32ch] text-[0.95rem] text-[var(--frost-dim)]">
          Five rules that cover most of what people get wrong at a blue bin.
        </p>
      </header>

      <ol className="divide-y divide-[var(--edge)] border-y border-[var(--edge)]">
        {FACTS.map((f, i) => (
          <li key={f.title} className="grid grid-cols-[2.2rem_1fr] gap-4 py-6">
            <span className="mono pt-1 text-[10px] text-[var(--frost-faint)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="mono text-[9px] text-[var(--aurora-1)]">{f.tag}</p>
              <h2 className="mt-1.5 text-[1.25rem] leading-tight">{f.title}</h2>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-[var(--frost-dim)]">
                {f.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mono mt-6 text-[9px] text-[var(--frost-faint)]">
        Written for the prototype · a live build would pull from NEA
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   VARIANT 2 — Deck
   Axis: interaction model. One fact at a time, swiped horizontally with
   the thumb. Consumed in seconds while standing at a bin.
   ──────────────────────────────────────────────────────────────── */
export function Deck() {
  const [i, setI] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    setI(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="rise">
      <header className="mb-5">
        <p className="mono text-[10px] text-[var(--frost-faint)]">Swipe through</p>
        <h1 className="mt-2 text-[2.2rem] leading-[0.98]">Five things worth knowing</h1>
      </header>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {FACTS.map((f) => (
          <article
            key={f.title}
            className="card card-lg flex min-h-[22rem] w-[calc(100vw-3rem)] max-w-[26rem] shrink-0 snap-center flex-col justify-between p-6"
          >
            <div>
              <p className="mono text-[9px] text-[var(--aurora-1)]">{f.tag}</p>
              <p className="tnum mt-6 text-[4.5rem] leading-none font-bold text-[var(--frost)]">
                {f.figure}
              </p>
              <p className="mono mt-2 text-[9px] text-[var(--frost-faint)]">{f.figureLabel}</p>
            </div>
            <div>
              <h2 className="text-[1.4rem] leading-tight">{f.title}</h2>
              <p className="mt-2.5 text-[0.92rem] leading-relaxed text-[var(--frost-dim)]">
                {f.body}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {FACTS.map((f, j) => (
          <motion.span
            key={f.title}
            className="h-1 rounded-full"
            animate={{
              width: j === i ? 22 : 6,
              backgroundColor: j === i ? "#1baf7a" : "rgba(185,228,246,0.22)",
            }}
            transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          />
        ))}
      </div>
      <p className="mono mt-3 text-center text-[9px] text-[var(--frost-faint)]">
        {i + 1} of {FACTS.length} · swipe
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   VARIANT 3 — Myth
   Axis: rhetorical framing. Each item is a belief struck through, then
   corrected. The tension carries it; the layout just serves the reveal.
   ──────────────────────────────────────────────────────────────── */
export function Myth() {
  return (
    <div className="stagger">
      <header className="mb-8">
        <p className="mono text-[10px] text-[var(--coral)]">Commonly believed</p>
        <h1 className="mt-2 text-[2.4rem] leading-[0.95]">
          Five things
          <br />
          that aren&rsquo;t true
        </h1>
      </header>

      <div className="space-y-9">
        {FACTS.map((f) => (
          <section key={f.title}>
            <p className="text-[1.15rem] leading-snug text-[var(--frost-faint)] line-through decoration-[var(--coral)] decoration-2">
              {f.belief}
            </p>
            <div className="mt-3 border-l-2 border-[var(--aurora-1)] pl-4">
              <h2 className="text-[1.2rem] leading-tight">{f.title}</h2>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-[var(--frost-dim)]">
                {f.body}
              </p>
            </div>
          </section>
        ))}
      </div>

      <p className="mono mt-8 text-[9px] text-[var(--frost-faint)]">
        Written for the prototype · a live build would pull from NEA
      </p>
    </div>
  );
}
