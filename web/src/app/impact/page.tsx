"use client";

import { useState } from "react";
import LineChart from "@/components/LineChart";
import {
  ACTUAL_D30,
  ACTUAL_LIFT,
  BASELINE_DAYS,
  COHORT,
  RETENTION,
  TARGET_D30,
  TARGET_LIFT,
  VANITY,
  WEEKLY,
} from "@/lib/impact";

export default function Impact() {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="space-y-10">
      {/* The one number the page leads with. */}
      <header className="rise">
        <div className="flex items-end gap-3">
          <span className="tnum text-[5rem] leading-[0.82] font-bold tracking-[-0.05em] text-[var(--aurora-1)]">
            +{ACTUAL_LIFT}
            <span className="text-[2.5rem]">%</span>
          </span>
        </div>
        <p className="mt-3 max-w-[30ch] text-[1.05rem] leading-snug text-[var(--frost-dim)]">
          more verified recycling actions per person per week, four weeks in — against a
          control arm that got the same app without the bear.
        </p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3.5 py-1.5">
          <span className="size-1.5 rounded-full bg-[var(--gold)]" />
          <span className="mono text-[9px] text-[var(--gold)]">
            Simulated · {COHORT}-person cohort
          </span>
        </div>
      </header>

      {/* How it was measured. */}
      <section className="rise">
        <SectionHead title="The metric" />
        <p className="mt-3 text-[0.95rem] text-[var(--frost-dim)]">
          <strong className="font-semibold text-[var(--frost)]">
            Verified recycling actions per person per week.
          </strong>{" "}
          Verified is doing the work — every action is a photo the model checked at the bin,
          so the number resists the self-reporting problem that makes most habit data
          unusable.
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--edge)] bg-[var(--edge)]">
          <Cell label={`Baseline · ${BASELINE_DAYS}d`} value={WEEKLY[0].bear.toFixed(1)} />
          <Cell label="Week 4 · bear" value={WEEKLY[4].bear.toFixed(1)} accent />
          <Cell label="Week 4 · control" value={WEEKLY[4].control.toFixed(1)} />
        </dl>
      </section>

      {/* Where the line settles once novelty wears off. */}
      <section className="rise">
        <SectionHead title="Where it settles" />
        <p className="mt-3 mb-5 text-[0.95rem] text-[var(--frost-dim)]">
          Week one is novelty — every habit app gets that. The question this design cares
          about is where the line lands afterwards, and whether it lands above the control.
        </p>
        <LineChart
          ticks={WEEKLY.map((w) => w.label.replace("Week ", "W").replace("Baseline", "Base"))}
          format={(v) => v.toFixed(1)}
          caption="Verified actions per person per week, bear arm versus control, weeks 0 to 4."
          series={[
            { label: "With the bear", values: WEEKLY.map((w) => w.bear), emphasis: true },
            { label: "Control", values: WEEKLY.map((w) => w.control) },
          ]}
        />
      </section>

      <section className="rise">
        <SectionHead title="Day 30, not day 1" />
        <p className="mt-3 mb-5 text-[0.95rem] text-[var(--frost-dim)]">
          Most habit apps are abandoned inside a week. Retention is the criterion that
          separates a mechanic from a novelty.
        </p>
        <LineChart
          ticks={RETENTION.map((r) => `D${r.day}`)}
          format={(v) => `${v}%`}
          yMax={110}
          caption="Share of each arm still logging, day 1 to day 30."
          series={[
            { label: "With the bear", values: RETENTION.map((r) => r.bear), emphasis: true },
            { label: "Control", values: RETENTION.map((r) => r.control) },
          ]}
        />

        <button
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="press hoverable mono mt-3 min-h-11 rounded-full border border-[var(--edge)] px-4 text-[9px] text-[var(--frost-dim)]"
        >
          {showTable ? "Hide" : "View"} the numbers
        </button>

        {showTable && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="mono text-[9px] text-[var(--frost-faint)]">
                  <th className="py-2 pr-3 font-normal">Day</th>
                  <th className="py-2 pr-3 font-normal">Bear</th>
                  <th className="py-2 font-normal">Control</th>
                </tr>
              </thead>
              <tbody className="tnum text-[0.85rem]">
                {RETENTION.map((r) => (
                  <tr key={r.day} className="border-t border-[var(--edge)]">
                    <td className="py-2 pr-3 text-[var(--frost-dim)]">D{r.day}</td>
                    <td className="py-2 pr-3">{r.bear}%</td>
                    <td className="py-2 text-[var(--frost-dim)]">{r.control}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Targets, stated in advance so they can be missed. */}
      <section className="rise">
        <SectionHead title="Targets, set in advance" />
        <ul className="mt-4 space-y-3">
          <Target
            hit={ACTUAL_LIFT >= TARGET_LIFT}
            label={`+${TARGET_LIFT}% actions per person per week by week 4`}
            actual={`+${ACTUAL_LIFT}%`}
          />
          <Target
            hit={ACTUAL_D30 >= TARGET_D30}
            label={`${TARGET_D30}% or more still active at day 30`}
            actual={`${ACTUAL_D30}%`}
          />
        </ul>
        <p className="mt-4 text-[0.9rem] text-[var(--frost-dim)]">
          Both were written down before any data existed, so either one could have failed.
        </p>
      </section>

      <section className="card rise px-5 py-5">
        <SectionHead title="How we would know it is the bear" />
        <p className="mt-3 text-[0.95rem] text-[var(--frost-dim)]">
          Half the cohort gets the full mechanic; half gets logging with no bear, no streak,
          no floe. Both arms are instrumented identically. Without that split, any lift could
          just be novelty or the kind of person who signs up, and we could not tell the
          difference. We cannot run 30 days in 24 hours. We can build the thing that would.
        </p>
      </section>

      {/* Deliberately last, deliberately quiet. */}
      <section className="rise pb-2">
        <h2 className="text-[1.05rem] text-[var(--frost-dim)]">Vanity metrics — not the point</h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 opacity-45">
          {VANITY.map((v) => (
            <p key={v.label} className="text-[0.85rem] text-[var(--frost-dim)]">
              <span className="tnum">{v.value}</span> {v.label.toLowerCase()}
            </p>
          ))}
        </div>
        <p className="mt-3 max-w-[38ch] text-[0.85rem] text-[var(--frost-faint)]">
          All three rise when a product is fun, and all three can rise in a week where nobody
          recycled anything extra. That is why they sit at the bottom of this screen.
        </p>
      </section>
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return <h2 className="text-[1.35rem]">{title}</h2>;
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[var(--night-1)] px-3 py-3.5">
      <dd
        className={`tnum text-[1.5rem] leading-none font-bold ${
          accent ? "text-[var(--aurora-1)]" : "text-[var(--frost)]"
        }`}
      >
        {value}
      </dd>
      <dt className="mono mt-1.5 text-[8px] leading-tight text-[var(--frost-faint)]">{label}</dt>
    </div>
  );
}

function Target({ hit, label, actual }: { hit: boolean; label: string; actual: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[var(--night-0)]"
        style={{ background: hit ? "var(--aurora-1)" : "var(--coral)" }}
      >
        {hit ? "✓" : "!"}
      </span>
      <span className="text-[0.95rem]">
        <span className="sr-only">{hit ? "Met: " : "Missed: "}</span>
        {label}
        <span className="mono tnum ml-2 text-[10px] text-[var(--frost-faint)]">{actual}</span>
      </span>
    </li>
  );
}
