# Floe — keep Nanuq's ice solid

**NUS LifeHack 2026 · Ecovolt track — "Small Green Habits: Nudging Real, Measurable
Sustainable Behaviour"**

A ten-second recycling habit, verified at the bin.

## The problem

Every hostel corridor has a poster telling you to recycle. Everybody walks past it. The
posters exist because they were the only instrument available for that spot — they sit at
the exact point of decision but cannot do anything.

The brief says it plainly: *"the problem is not a lack of information, it is a lack of
motivation and delight."* So Floe does not add more information. It replaces the poster
with something that acts.

## The behaviour we are shifting

> Correctly sorting a recyclable item into the right bin, instead of dropping it in
> general waste.

**Audience:** students in NUS hostels and on campus.

## How it works

1. **A code at the bin.** Scanning it mints a one-time slot tied to that bin — the
   intervention is where and when the decision happens, not in an app you must remember
   to open.
2. **One photo.** Hold the item at the bin and shoot.
3. **The model checks it.** Claude verifies a real recyclable is really going into a bin,
   and whether the stream is right. A slot can only be filled once.
4. **Nanuq responds.** The bear's ice floe visibly shrinks the longer you go without
   acting, and recovers when you log. You are protecting something, not earning a badge.

## Behaviour-change mechanics (deliberate, named)

| Mechanic | Where it shows up |
|---|---|
| **Point-of-decision prompt** | The QR lives at the bin. Habit apps die because they need you to remember them; this one is triggered by the environment. |
| **Loss aversion** | The floe degrades with time since your last action. Losing ice is felt more sharply than gaining a point. |
| **Commitment + streak** | A visible run you don't want to break. |
| **Verification** | AI validation means an action is real, not self-declared — which is also what makes the metric trustworthy. |
| **Friction removal** | Nearest-bin locator and a "which bin?" assistant, for the moments where hesitation ends in general waste. |

The bear works as **loss aversion, not guilt**. Guilt-and-lecture is exactly the approach
the brief says has failed, so the copy never moralises.

## Measurement

Judging criterion 2 asks for a baseline, a metric, and a target. Ours, visible in-app at
`/impact`:

- **Metric** — verified recycling actions per user per week. *Verified* is load-bearing.
- **Baseline** — a 7-day logging-only run-in before the bear is introduced, plus a
  self-reported weekly count at signup.
- **Target** — +40% actions per user per week by week 4, and ≥50% of users still active at
  **day 30**.
- **Control arm** — half the cohort gets logging only, no bear. We cannot run a 30-day
  study in 24 hours, but the app is instrumented for it and the design is stated.
- Vanity metrics (photos uploaded, app opens) are shown **separately and labelled as not
  the point**.

The Impact screen's cohort figures are **simulated and labelled as such throughout**. The
brief permits mocked inputs; it does not permit presenting them as real.

## Running it

Requires Node 20+.

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

### API key

Photo validation and the assistant call the Anthropic API.

```bash
cp .env.example .env      # then fill in your key
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

**Without a key the app still runs.** The validator returns a stubbed verdict and the UI
says so explicitly on screen — so the demo survives a dead network, without ever pretending
a photo was checked when it wasn't.

### Walking through it

1. Open `/` — Nanuq, the floe, your streak.
2. Press **Scan the code at COM3 Level 1**. This stands in for a phone camera reading a
   printed QR; it mints a real one-time scan instance.
3. Take or upload a photo. It is validated, then logged, and the streak advances.
4. Open `/impact` for the measurement story.

## Project layout

```
web/src/
  app/
    page.tsx              home — bear, streak, scan entry
    scan/[id]/page.tsx    camera capture + verdict
    impact/page.tsx       baseline, metric, target, control arm
    bins/  chat/  news/   friction removers and context
    api/validate/         Claude vision verification
    api/log/              scan instances, action log, bear state
  components/Bear.tsx     SVG floe that shrinks with health
  lib/bear.ts             mood, health, streak logic
  lib/store.ts            in-memory store + campus bin data
  lib/impact.ts           simulated cohort data (labelled)
```

The store is deliberately in-memory: a 24-hour prototype should not lose its demo to a
dropped database connection. It is a single module to swap.

## Team

`domjcwl` · `infernoxthecat` · `zerethkit` · `raviharikkrishna`

## Acknowledgements

- **Next.js 16**, **React 19**, **Tailwind CSS 4** — application framework and styling,
  scaffolded with `create-next-app` during the event.
- **Anthropic Claude API** (`@anthropic-ai/sdk`, `claude-opus-5`) — photo verification and
  the recycling assistant.
- Campus bin locations are **representative sample data**, not an official NEA or NUS
  dataset.
- Impact-screen cohort figures are **simulated**, as described above.
- Singapore recycling guidance in the assistant's prompt reflects publicly documented NEA
  blue-bin rules.

**Pre-existing code:** none. All application code in `web/` was written during the
hackathon. Documentation, `.gitignore` and the team's Claude skills under `.claude/` were
committed before the 11:00 problem-statement release and are visible as such in the git
history.
