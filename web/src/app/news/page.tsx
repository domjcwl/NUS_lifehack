"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Action } from "@/lib/types";

/**
 * The rule you most need is the one about the thing you actually bin. So this
 * screen reads the user's own verified history and leads with the rule that
 * matches it — which is a Learn screen no other product could ship, because it
 * depends on what Floe already knows about you.
 */

type Material = "plastic" | "paper" | "metal" | "glass" | "mixed";

interface Rule {
  material: Material;
  lead: string;
  detail: string;
  /** The specific mistake this rule prevents, in the user's own terms. */
  costs: string;
}

const RULES: Rule[] = [
  {
    material: "plastic",
    lead: "Rinse it, or the whole bag goes.",
    detail:
      "A container with sauce still in it contaminates everything it touches on the way to the sorting facility. One tub can turn a full bag of recycling into general waste.",
    costs: "Three seconds under a tap is the whole fix.",
  },
  {
    material: "paper",
    lead: "Grease is the dividing line.",
    detail:
      "The oily base of a pizza box is general waste. The clean lid recycles. Cardboard is only recyclable while it is dry and unsoiled.",
    costs: "Tear the box in half rather than binning all of it either way.",
  },
  {
    material: "metal",
    lead: "Cans are the easy win.",
    detail:
      "Aluminium recycles indefinitely with no loss of quality, and it is the single most valuable thing in a blue bin. A quick rinse is still worth it.",
    costs: "Leave the tab on — it is the same metal.",
  },
  {
    material: "glass",
    lead: "Caps and lids come off.",
    detail:
      "Glass and its metal or plastic cap are separated by different processes. Left on, the cap usually means the whole item is pulled from the line.",
    costs: "Both parts recycle — just not attached to each other.",
  },
  {
    material: "mixed",
    lead: "Soft plastics are not accepted.",
    detail:
      "Bags, wrappers and cling film jam the machinery at materials recovery facilities. They belong in general waste unless there is a dedicated collection point.",
    costs: "If it scrunches in your fist and stays scrunched, it is not for the blue bin.",
  },
];

/** Blunt keyword match — enough to pick a relevant rule, honest about it. */
function materialOf(item: string): Material {
  const t = item.toLowerCase();
  if (/bottle|tub|container|cup|plastic|pet/.test(t)) return "plastic";
  if (/card|paper|box|carton|sleeve|newspaper/.test(t)) return "paper";
  if (/can|tin|foil|aluminium|aluminum|metal/.test(t)) return "metal";
  if (/glass|jar/.test(t)) return "glass";
  return "mixed";
}

export default function Learn() {
  const [recent, setRecent] = useState<Action[] | null>(null);

  useEffect(() => {
    fetch("/api/log")
      .then((r) => r.json())
      .then((d) => setRecent(d.recent ?? []))
      .catch(() => setRecent([]));
  }, []);

  const counts = new Map<Material, number>();
  (recent ?? []).forEach((a) => {
    const m = materialOf(a.item);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  });

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const leadRule = RULES.find((r) => r.material === top?.[0]) ?? RULES[0];
  const rest = RULES.filter((r) => r !== leadRule);

  return (
    <div className="space-y-9">
      <h1 className="rise text-[2.2rem]">
        {top ? (
          <>
            You mostly bin{" "}
            <span className="text-[var(--aurora-1)]">{top[0] === "mixed" ? "a mix" : top[0]}</span>.
            <br />
            Here is what that needs.
          </>
        ) : (
          <>What actually goes in the bin</>
        )}
      </h1>

      {/* The lead rule gets the weight; the rest are a list, not more cards. */}
      <section className="rise">
        <p className="text-[1.65rem] leading-[1.12] text-[var(--frost)]">{leadRule.lead}</p>
        <p className="mt-4 max-w-[46ch] text-[1rem] leading-relaxed text-[var(--frost-dim)]">
          {leadRule.detail}
        </p>
        <p className="mt-3 max-w-[46ch] text-[1rem] leading-relaxed text-[var(--aurora-1)]">
          {leadRule.costs}
        </p>

        {top && (
          <p className="mt-5 text-[0.9rem] text-[var(--frost-faint)]">
            Picked because {top[1]} of your last {(recent ?? []).length} verified{" "}
            {top[1] === 1 ? "action was" : "actions were"}{" "}
            {top[0] === "mixed" ? "unmatched" : top[0]}.
          </p>
        )}
      </section>

      {/* Hanging-indent rules — a reference list, deliberately not a card stack. */}
      <section className="rise space-y-7 border-t border-[var(--edge)] pt-7">
        {rest.map((r) => (
          <article key={r.material} className="grid grid-cols-[4.5rem_1fr] gap-4">
            <span className="mono pt-1 text-[10px] text-[var(--frost-faint)]">{r.material}</span>
            <div>
              <h2 className="text-[1.1rem] leading-snug">{r.lead}</h2>
              <p className="mt-1.5 text-[0.92rem] leading-relaxed text-[var(--frost-dim)]">
                {r.detail}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="rise border-t border-[var(--edge)] pt-7">
        <p className="text-[1rem] text-[var(--frost-dim)]">
          Still not sure about something in your hand?
        </p>
        <Link
          href="/chat"
          className="press btn-primary mt-4 inline-flex min-h-14 items-center rounded-full px-6 text-[0.95rem]"
        >
          Ask about an item
        </Link>
      </section>

      <p className="text-[0.85rem] text-[var(--frost-faint)]">
        Guidance follows NEA&rsquo;s published blue-bin rules. Written for the prototype.
      </p>
    </div>
  );
}
