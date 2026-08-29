# Floe — keep Nanuq's ice solid

**NUS LifeHack 2026 · Ecovolt track — "Small Green Habits: Nudging Real, Measurable
Sustainable Behaviour"**

A ten-second recycling habit, verified at the bin.

## The problem

Every HDB lift lobby has a poster telling you to recycle, and a blue bin a few steps away.
Everybody walks past both. The poster exists because it was the only instrument available
for that spot — it sits at the exact point of decision but cannot do anything.

The brief says it plainly: *"the problem is not a lack of information, it is a lack of
motivation and delight."* So Floe does not add more information. It replaces the poster
with something that acts.

## The behaviour we are shifting

> Correctly sorting a recyclable item into the right bin, instead of dropping it in
> general waste.

**Audience:** HDB residents in Singapore — the 80% of the population living within a
minute's walk of one of the 12,291 blue bins in NEA's dataset.

## How it works

1. **A code at the bin.** Scanning it mints a one-time slot tied to that specific blue
   bin — the intervention is where and when the decision happens, not in an app you must
   remember to open.
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

## App features

### Pet & friends
- The main Pet/Friends tab shows the user's own pet at the top, centered for a clear mobile-first display.
- The user sees their polar bear companion, with an XP bar and level badge starting at level 1.
- Each friend card in the list links to a dedicated friend detail page, where that friend's pet is displayed separately.
- Clicking a friend keeps the interaction focused and easy to use on a phone, rather than swapping one pet in-place on the same screen.

### Progression and XP
- Every pet has a level and XP bar that starts from level 1.
- The bar tracks progress toward the next level and is shown on both the user's pet and friends' pets.
- The level value is displayed beside the pet name for quick scanning in the list and detail view.
- This creates a lightweight motivation loop: completion of the app's actions feeds pet growth and progression.

### Demo-friendly behaviour
- The current implementation uses a simple, visible progression model for the prototype so the pet feels active and rewarding during testing.
- The feature is intentionally lightweight and can be expanded later to tie XP to real actions such as bin scans, daily streak completion, or user engagement moments.

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
2. Press **Scan the code at Blk 826A**. This stands in for a phone camera reading a QR
   printed on the bin; it mints a real one-time scan instance. Blk 826A Tampines Street 81
   is a real blue-bin location from the NEA dataset.
3. Take or upload a photo. It is validated, then logged, and the streak advances.
4. Open `/bins` for the island-wide map — 13,006 real NEA points, clustered.
5. Open `/impact` for the measurement story.

### Why HDB residents, and not students

We started from a hostel poster, but the data moved us. NEA's recycling-bin dataset is
**HDB estates**: the nearest blue bin to NUS in the national data is ~1.1 km away, against
~125 m in Tampines. Aiming a bin-anchored habit at the one population that has no bins
nearby would have been designing against our own evidence. The blue bin at the foot of an
HDB block is the densest point-of-decision surface in Singapore, so that is where Floe
lives. E-waste points *do* cover campus, which is a natural second phase.

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
- **motion** (Framer Motion) — spring animations; **clsx** — conditional class names.
- **Design guidance** from [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT) —
  `emil-design-eng` and `apple-design` informed the motion, easing and mobile interaction
  decisions. Guidance only; none of that repo's code ships here.
- **Anthropic Claude API** (`@anthropic-ai/sdk`, `claude-opus-5`) — photo verification and
  the recycling assistant.
- **Bin locations are real open government data**, not samples: NEA's *Recycling Bins*
  (12,291 points), *E-waste Recycling* (713) and *Lighting Waste Collection Points* (2)
  datasets, retrieved from [data.gov.sg](https://data.gov.sg) on 29 Aug 2026 under the
  Singapore Open Data Licence. `scripts/fetch-bins.py` and `scripts/build-bins.py`
  reproduce `web/data/bins.json` from source.
- **Basemap tiles from [OneMap](https://www.onemap.gov.sg/)** © Singapore Land Authority —
  the official national basemap, no API key required.
- **Leaflet** / **react-leaflet** for the map, **supercluster** for server-side clustering.
- Impact-screen cohort figures are **simulated**, as described above.
- Singapore recycling guidance in the assistant's prompt reflects publicly documented NEA
  blue-bin rules.

**Pre-existing code:** none. All application code in `web/` was written during the
hackathon. Documentation, `.gitignore` and the team's Claude skills under `.claude/` were
committed before the 11:00 problem-statement release and are visible as such in the git
history.
