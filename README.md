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

1. **A code at the bin.** Every bin in Singapore has its own QR, so scanning names that blue
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

Photo validation and the assistant call OpenAI. **One key serves the whole
project** — the Next.js app and the Python backend both read `OPENAI_API_KEY`
and both default to `gpt-4o-mini`.

```bash
cd web && cp .env.example .env    # then fill in your key
# web/.env
OPENAI_API_KEY=sk-proj-...
```

`OPENAI_MODEL` and `OPENAI_VISION_MODEL` are optional overrides; their defaults
mirror `backend/app/config.py` so the two services stay in step.

**Without a key the app still runs.** The validator returns a stubbed verdict and the UI
says so explicitly on screen — so the demo survives a dead network, without ever pretending
a photo was checked when it wasn't.

### Walking through it

1. Open `/` — Nanuq, the floe, your streak.
2. Press **Find a bin near you**, tap any bin on the map, then **Log at this bin** — the
   same page its printed QR opens. To see the sticker itself, tap **QR sticker**; Blk 826A
   Tampines Street 81
   is a real blue-bin location from the NEA dataset.
3. Take or upload a photo. It is validated, then logged, and the streak advances.
4. Open `/bins` for the island-wide map — 12,902 real NEA points, drawn individually.
5. Open `/impact` for the measurement story.

### Why HDB residents, and not students

We started from a hostel poster, but the data moved us. NEA's recycling-bin dataset is
**HDB estates**: the nearest blue bin to NUS in the national data is ~1.1 km away, against
~125 m in Tampines. Aiming a bin-anchored habit at the one population that has no bins
nearby would have been designing against our own evidence. The blue bin at the foot of an
HDB block is the densest point-of-decision surface in Singapore, so that is where Floe
lives. E-waste points *do* cover campus, which is a natural second phase.

## The QR on the bin

Every one of the 12,902 bins has its own code and its own QR, generated on demand at
`/api/qr/<code>` and printable from `/bins/<code>/qr`. Scanning opens `/scan/<code>`, which
is that bin's page: the photo gets logged against that block rather than against nothing.

**The code is derived from the bin's coordinates and postal code, never from its position in
the dataset.** A sticker is printed once and then outlives the data behind it — `bins.json`
gets rebuilt from NEA's feed, and if the code were an array index, a single insertion upstream
would silently repoint every sticker in Singapore at the wrong bin. Verified collision-free
across all 12,902: NEA's feed lists 13,004 rows, but 102 are the same physical spot entered
twice — those collapse to one bin each, so one place never gets two stickers.

Codes avoid `0`/`O` and `1`/`I`/`L`, like the group invite codes, because a peeled sticker
gets read aloud and typed.

**What this does and does not prove.** It proves the photo was taken by someone who had that
bin's code. It does not prove they were standing there — a printed QR is static, so it can be
photographed once and reused from a sofa. The defence that does work is the content hash: the
same photo cannot be logged twice. A serious deployment would rotate a code on a small display,
or check the phone's location against the bin's. We did neither, and say so rather than
claiming the QR is proof of presence.

## Accounts, groups and growth

Sign-in and account creation live on one page at **`/login`**, which takes an
optional `?next=` (in-app paths only) and a `?mode=signin`. It is never the
front door: the app opens straight into the bear, and `/login` is reached when
you try to do something that needs an identity.

**Guest first.** Opening the app mints a guest identity with a real session and a
short seeded history, so the mechanic works before anyone signs up. Claiming a
username converts that guest row **in place**, so the streak built as a guest
carries over rather than resetting — which is the whole reason the flow is
guest-first rather than login-first.

- **Unique usernames**, 3–20 chars, `[a-z0-9_]`, checked live as you type and
  enforced by a `UNIQUE` constraint rather than by the check alone.
- **Groups** are a block, a flat or a family. Create one and share a six-character
  invite code; the alphabet excludes `0/O` and `1/I/L` because the code gets read
  aloud and typed by someone else.
- Every member keeps **their own bear** — the group is where you see whose ice is
  holding, not a shared pet. Loss aversion stays personal.
- A member row carries their **live bear state** (streak, mood, floe health,
  level). You cannot see their bins, their location, or what they threw away.
- Guests can use everything except groups, and are prompted to claim a username
  at the point they try.

### Points and growth

Points are not the reward — **the bear is**. Every point goes into the animal
getting visibly bigger, from a cub at level 1 to a great bear at level 11, so
progress is something you see rather than a number in a corner. This is the
answer to the brief's warning about "a badge stuck on a dashboard": there is no
badge, and the dashboard number exists only to explain the growth.

| Award | Points |
|---|---|
| A verified action at a bin | 10 |
| The item went into the right stream | +5 |
| Every seventh consecutive day | +25 |

XP is the **sum of a ledger**, never a stored counter, so every point can be
explained and nothing drifts.

**The same photo cannot be logged twice.** Each verified image is content-hashed
and the hash is unique per user. It is a content hash, not a perceptual one — a
re-crop defeats it. Enough to stop the lazy path of re-submitting one saved
image, not a serious anti-fraud measure.

### Storage

SQLite via **`node:sqlite`**, which ships in Node 22+ — so there is no native
module to compile, which matters on Windows. The database is a single file at
`web/data/floe.db`, git-ignored because it holds user data.

**Every query lives in `src/lib/repo.ts`.** Nothing else in the app talks to the
database. Swapping SQLite for the real backend means reimplementing that one
module's exports and touching nothing else.

### Profile

`/profile` shows the record and lets you rename the account. It is reached from
the friends screen rather than a tab — six tabs already sits at the limit of
what a person can hold, and a seventh would cost more than it adds.

Stats are behavioural rather than invented: current and longest streak, days
active against days since the first action, this week against last week, weekly
rate, and a breakdown of what you bin. There is no fabricated CO₂ figure — we do
not measure the mass of what goes in the bin, so we do not claim it.

**Renaming frees the old handle immediately.** Friendships key on the account id,
so they survive a rename and the friend list updates — but someone could then
take the vacated username and be mistaken for its previous owner. A real build
would reserve retired handles for a cooling-off period. Called out here because
it is a deliberate omission, not an oversight.

### Security — read this before judging it

**The PIN is prototype-grade, and we are not claiming otherwise.** PINs are
salted and hashed with scrypt, sessions are opaque random tokens in an
`httpOnly`, `sameSite=lax` cookie, and the login error is identical for a wrong
username and a wrong PIN so the form cannot be used to enumerate accounts.

What it is **not**: there is no rate limiting, no lockout, no password reset, no
email verification, and a 4-digit PIN has 10,000 combinations. It is the right
amount of auth for a 24-hour prototype where nothing of value is protected, and
it is the wrong amount for anything real.

## Project layout

```
web/src/
  app/
    page.tsx              home — bear, streak, scan entry
    scan/[code]/          the page a bin's QR opens: camera capture + verdict
    bins/[code]/qr/       printable sticker for one bin
    api/qr/[code]/        that bin's QR, as SVG
    impact/page.tsx       baseline, metric, target, control arm
    bins/  chat/  news/   friction removers and context
    api/validate/         Claude vision verification
    api/log/              action log, points, bear state
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
- **Bricolage Grotesque** and **IBM Plex Mono** (Google Fonts, via `next/font`) — display
  and data type respectively.
- **Design guidance** from [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT) —
  `emil-design-eng` and `apple-design` informed the motion, easing and mobile interaction
  decisions. Guidance only; none of that repo's code ships here.
- **OpenAI API** (`openai`, `gpt-4o-mini`) — photo verification and the recycling
  assistant. Chosen over a second provider so one key covers both the Next.js app
  and the Python backend.
- **Bin locations are real open government data**, not samples: NEA's *Recycling Bins*
  (12,291 points) and *E-waste Recycling* (713) datasets, retrieved from
  [data.gov.sg](https://data.gov.sg) on 29 Aug 2026 under the
  Singapore Open Data Licence. `scripts/fetch-bins.py` and `scripts/build-bins.py`
  reproduce `web/data/bins.json` from source.
- **Basemap tiles from [OneMap](https://www.onemap.gov.sg/)** © Singapore Land Authority —
  the official national basemap (Night style), no API key required.
- **Leaflet** / **react-leaflet** for the map, drawn on canvas. **qrcode** for the bin stickers.
- Impact-screen cohort figures are **simulated**, as described above.
- Singapore recycling guidance in the assistant's prompt reflects publicly documented NEA
  blue-bin rules.

**Pre-existing code:** none. All application code in `web/` was written during the
hackathon. Documentation, `.gitignore` and the team's Claude skills under `.claude/` were
committed before the 11:00 problem-statement release and are visible as such in the git
history.
