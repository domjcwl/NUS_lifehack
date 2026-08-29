import {
  ACTUAL_D30, ACTUAL_LIFT, BASELINE_DAYS, COHORT, RETENTION,
  TARGET_D30, TARGET_LIFT, VANITY, WEEKLY,
} from "@/lib/impact";

export default function Impact() {
  const peak = Math.max(...WEEKLY.map((w) => w.bear));

  return (
    <div className="space-y-6 rise">
      <header>
        <p className="mono text-[10px] text-[var(--ink-soft)]">How we would know it worked</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Impact</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          One behaviour, one metric, a baseline and a target. Engagement numbers sit at
          the bottom because they are not the point.
        </p>
      </header>

      <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-3">
        <p className="mono text-[10px] text-[var(--gold)]">Simulated</p>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Every figure on this page is generated from a modelled {COHORT}-person cohort.
          Nothing here is a measured result. This is the study design, instrumented.
        </p>
      </div>

      <section className="card px-5 py-5">
        <p className="mono text-[10px] text-[var(--ink-soft)]">The metric</p>
        <h2 className="mt-1 text-lg font-semibold">Verified recycling actions per user per week</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          <strong className="text-[var(--ink)]">Verified</strong> is doing the work. Every action is a
          photo the model checked at the bin, so the number resists the self-reporting problem
          that makes most habit data unusable.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Metric label="Baseline" value={String(WEEKLY[0].bear)} sub={`${BASELINE_DAYS}-day run-in`} />
          <Metric label="Week 4" value={String(WEEKLY[4].bear)} sub="bear arm" accent />
          <Metric label="Control" value={String(WEEKLY[4].control)} sub="logging only" />
        </dl>
      </section>

      <section className="card px-5 py-5">
        <p className="mono text-[10px] text-[var(--ink-soft)]">Actions per user per week</p>
        <div className="mt-4 space-y-3">
          {WEEKLY.map((w) => (
            <div key={w.week}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="mono text-[10px] text-[var(--ink-soft)]">{w.label}</span>
                <span className="tabular-nums">
                  <strong>{w.bear}</strong>
                  <span className="text-[var(--ink-soft)]"> vs {w.control}</span>
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                <Bar value={w.bear} max={peak} color="var(--sea)" />
                <Bar value={w.control} max={peak} color="var(--ink-soft)" faded />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--ink-soft)]">
          The week-1 spike is novelty. The question this design cares about is where the
          line settles, and whether it settles above the control arm.
        </p>
      </section>

      <section className="card px-5 py-5">
        <p className="mono text-[10px] text-[var(--ink-soft)]">Still active</p>
        <h2 className="mt-1 text-lg font-semibold">Day 30, not day 1</h2>
        <div className="mt-4 space-y-2.5">
          {RETENTION.map((r) => (
            <div key={r.day} className="flex items-center gap-3">
              <span className="mono w-12 shrink-0 text-[10px] text-[var(--ink-soft)]">D{r.day}</span>
              <div className="flex-1 space-y-1">
                <Bar value={r.bear} max={100} color="var(--sea)" />
                <Bar value={r.control} max={100} color="var(--ink-soft)" faded />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums">
                <strong>{r.bear}%</strong>
                <span className="text-[var(--ink-soft)]"> / {r.control}%</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card px-5 py-5">
        <p className="mono text-[10px] text-[var(--ink-soft)]">Targets set in advance</p>
        <ul className="mt-3 space-y-3 text-sm">
          <Target
            hit={ACTUAL_LIFT >= TARGET_LIFT}
            label={`+${TARGET_LIFT}% actions per user per week by week 4`}
            actual={`modelled +${ACTUAL_LIFT}%`}
          />
          <Target
            hit={ACTUAL_D30 >= TARGET_D30}
            label={`≥${TARGET_D30}% of users still active at day 30`}
            actual={`modelled ${ACTUAL_D30}%`}
          />
        </ul>
        <p className="mt-4 text-xs text-[var(--ink-soft)]">
          Stated before the data existed, so they can be missed. A target you can only
          pass is not a target.
        </p>
      </section>

      <section className="card px-5 py-5">
        <p className="mono text-[10px] text-[var(--ink-soft)]">The honest part</p>
        <h2 className="mt-1 text-lg font-semibold">How we would know it is the bear</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Half the cohort gets the full mechanic; half gets logging with no bear, no streak,
          no floe. Both arms are instrumented identically. Without that split, any lift could
          just be novelty or the kind of person who signs up — and we could not tell the
          difference. We cannot run 30 days in 24 hours. We can build the thing that would.
        </p>
      </section>

      <section className="card px-5 py-5">
        <p className="mono text-[10px] text-[var(--ink-soft)]">Vanity metrics</p>
        <h2 className="mt-1 text-lg font-semibold">Not the point</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 opacity-55">
          {VANITY.map((v) => (
            <Metric key={v.label} label={v.label} value={v.value} sub="" />
          ))}
        </dl>
        <p className="mt-3 text-xs text-[var(--ink-soft)]">
          These go up when a product is fun. They can go up while nobody recycles more,
          which is exactly why they are down here and the metric above is not.
        </p>
      </section>
    </div>
  );
}

function Bar({ value, max, color, faded }: { value: number; max: number; color: string; faded?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ice-1)]">
      <div
        className="h-full rounded-full"
        style={{ width: `${(value / max) * 100}%`, background: color, opacity: faded ? 0.35 : 1 }}
      />
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--edge)] bg-white/60 px-3 py-3">
      <dd className={`text-xl font-semibold ${accent ? "text-[var(--sea)]" : ""}`}>{value}</dd>
      <dt className="mono mt-0.5 text-[9px] text-[var(--ink-soft)]">{label}</dt>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--ink-soft)]">{sub}</p>}
    </div>
  );
}

function Target({ hit, label, actual }: { hit: boolean; label: string; actual: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
        style={{ background: hit ? "var(--sea)" : "var(--coral)" }}
      >
        {hit ? "✓" : "!"}
      </span>
      <span>
        {label}
        <span className="mono ml-2 text-[10px] text-[var(--ink-soft)]">{actual}</span>
      </span>
    </li>
  );
}
