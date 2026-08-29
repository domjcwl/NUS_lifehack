# Decision log

Append-only. One entry per decision, with the reason. Cheap to write, and it answers "why did we
do it this way" at 04:00 when nobody remembers.

Format: `### <time> — <decision>` then **Why** and, if relevant, **Revisit if**.

---

### Sat 09:30 — Broad topic: sustainability
Team direction going into the event. Actual problem statements released 11:00.
**Why:** team preference. Ecovolt is the partner whose domain matches (smart buildings, IoT,
sustainability) — background gathered in `docs/sustainability-primer.md`.
**Revisit if:** at 11:00 another brief scores clearly higher in `brief-triage`. The topic is a
prior, not a commitment.

### Sat 09:35 — Stack deferred to 11:00
No framework, no dependencies chosen before the briefs are known.
**Why:** picking a stack before knowing the problem risks an hour of rework. Also keeps us
cleanly inside the rule that development happens primarily during the event. Candidate stacks and
verified commands are staged in `.claude/skills/hack-scaffold/SKILL.md`.

### Sat 09:35 — Deployment target deferred
**Why:** depends on the stack. Local-only is a valid answer — judging is at our station, so a
hosted URL is a nice-to-have, not a requirement. Do not spend demo-critical time on deployment.

### Sat 09:35 — Plugins not installed
Shortlist staged in `docs/plugin-shortlist.md`, mapped to likely briefs.
**Why:** installing everything up front bloats context for no benefit. Install only what the
chosen brief needs, at ~11:05.

### Sat 09:35 — Pre-event prep is docs and tooling only
No product code written before 11:00.
**Why:** the rules require development to happen primarily during the hackathon and require
disclosure of significant pre-existing code. Documentation, `.gitignore` and Claude skills are
tooling, not product, and are visible in the git history with timestamps before 11:00.

### Sat 09:35 — Working copy lives inside OneDrive
Path: `C:\Users\ravih\OneDrive\Desktop\LifeHack\NUS_lifehack`
**Why:** that is where the session was set up.
**Revisit if:** `npm install` or `pip install` throws `EPERM` or stalls — OneDrive locks files.
Fix is to move the folder outside OneDrive. Worth doing *before* the first dependency install.

---

### Sat ~12:50 — Audience moves from NUS students to HDB residents
**Why:** the NEA data settled it. Their recycling-bin dataset covers HDB estates, so the
nearest blue bin to NUS is ~1.1km away against ~125m in Tampines. A bin-anchored habit
aimed at the one population without bins nearby is designing against our own evidence.
The blue bin at the foot of an HDB block is the densest point-of-decision surface in
Singapore.
**What changed:** problem statement, README, in-app copy, chatbot system prompt, and the
demo scan anchor (now Blk 826A Tampines Street 81, a real bin from the dataset).
**What did not change:** the behaviour, the mechanics, and the measurement story. The
poster insight still holds — HDB lift lobbies have the same dead posters hostels do.
**Revisit if:** a judge pushes on the NUS connection. E-waste points *do* cover campus,
so a campus phase is a natural extension rather than a retreat.

## TO ADD AT 11:00 (from `brief-triage`)

```
CHOSEN: <brief> — <one-line why>
PROBLEM: For <user>, who <problem>, we build <thing> that <outcome>.
DEMO MOMENT: <the one thing we show>
MVP: 1. … 2. … 3. …
CUT (not building): …
RISKIEST ASSUMPTION: … → test by <time>
OWNERS: dom=… inferno=… zereth=… hari=…
STACK: …
```

---

# LOCKED SPEC — Sat 11:20

### Sat 11:15 — Brief: Ecovolt, "Small Green Habits"
Only brief considered; team topic was sustainability and this is the sustainability track.
Full text: `docs/problem-statement.md`.

### Sat 11:20 — Domain: WASTE / RECYCLING (not energy)
**Why:** the feature set we designed (photo at the bin, AI validation, bin locator) is built for
waste. The brief's hard constraint is *one concrete behaviour*, and splitting across energy and
waste would cost points on behaviour-change and measurability.
**Considered and rejected:** energy / idle plug load — closer to Ecovolt's own product, but it
kills the bin-locator feature and "photograph a dark room" is a harder validation problem.

### Sat 11:20 — Scope: all five features, sequenced
Team decision to keep the full feature set. Sequenced so the core loop is demo-ready early and
the rest layers on top — see build order below. **Non-negotiable: the P0 loop must be usable end
to end before anyone starts P2.**

---

## The spec

**Audience:** NUS students in hostels / on campus.

**Behaviour we are shifting (exactly one):**
> Correctly sorting a recyclable item into the right bin, instead of dropping it in general waste.

**Problem statement:**
> For NUS students, who know they should recycle but walk past the "please recycle" poster without
> acting, we build a game that turns each correct recycling action into a 10-second, verified,
> social moment — so the intention becomes a repeated habit.

**Behaviour-change mechanics (deliberate, named):**
| Mechanic | How it shows up |
|---|---|
| **Point-of-decision prompt** | QR code at the bin creates a unique instance — the intervention is where and when the decision happens, not in an app you must remember to open |
| **Loss aversion** | The polar bear degrades if you don't act. You are protecting something, not earning a badge |
| **Commitment + streak** | Visible run you don't want to break |
| **Verification** | AI validates the photo, so the action is real rather than self-declared |
| **Social proof** | Floor/hostel-level comparison |

**Framing rule:** the polar bear works as *loss aversion*, not as guilt. Copy never lectures.
Guilt-and-lecture is precisely what the brief says has failed.

## Measurement story (judging criterion 2)

- **Metric:** verified recycling actions per user per week. *Verified* is load-bearing — AI
  validation is what makes this trustworthy rather than self-reported.
- **Baseline:** first 7 days run as a logging-only onboarding week, before the bear is introduced.
  Plus a self-reported "how many times last week?" at signup.
- **Target:** +40% verified actions/user/week by week 4, and **≥50% of users still active at day
  30**.
- **Control arm:** half the cohort gets logging only, half gets the bear. We cannot run a 30-day
  study in 24h, but the study is *designed* and the app is instrumented for it — that is the
  honest answer to "how do you know it is your mechanic and not novelty?"
- **Report vanity vs behaviour metrics separately.** Signups, app opens and photo counts are
  vanity. The Impact screen shows behaviour metrics only.

**Deliverable:** an **Impact screen** seeded with 30 days of simulated cohort data — baseline
week, intervention, both arms diverging, retention curve. Explicitly labelled as simulated.
The brief permits mocked data; it does not permit pretending mocked data is real.

## Build order

| Pri | Feature | Done when |
|---|---|---|
| **P0** | QR → unique instance → camera → AI validation → polar bear state → streak | A stranger can scan, photograph, and see the bear respond. **This is the demo.** |
| **P1** | Impact screen with seeded cohort data (baseline / target / control arm / retention) | Judge can see the measurement story on screen |
| **P2** | Nearest-bin locator | Friction remover; real map, real campus bins |
| **P3** | Chatbot for waste/recycling questions | "Can I recycle this?" at the point of decision |
| **P4** | Environmental news feed | Lowest priority — informational, and the brief says information is not the problem |

**Feature freeze 03:00. Hands off features 09:00 Sunday** — then `submission-checklist`.

## Stack

Next.js (App Router) + TypeScript + Tailwind, in `web/`. Single repo, API routes for the AI
validation and chatbot, deploys as one unit. Chosen because the prototype must be *usable by a
real person on a phone* — a web app opened from a QR code needs no install.

## Owners
> Fill in: dom = · inferno = · zereth = · hari =

### Sat 14:55 — Groups are joined by invite code, and leaderboard ties share a rank
Invite codes are 6 characters from an alphabet with no confusable pairs (`0`/`O`,
`1`/`I`/`L`, `S` removed); input is case- and dash-insensitive.
**Why:** the second person joining is the moment the social mechanic starts working. A
code that can be read aloud across a table removes the friction; a numeric id does not.
Ties share a rank because inventing an order between equal scores is arbitrary and the
person who loses the coin flip can see it.
**Also:** leaving a group does not delete past activities or point transactions —
a group's totals are its record, and rewriting them on exit would corrupt the
measurement story the pitch depends on.

### Sat 14:50 — NOTE: two backends now exist in this repo
`backend/` (FastAPI, this workstream) and `web/` (Next.js API routes + `web/data/floe.db`,
covering auth, bins, chat, validate, friends, log, plus `lib/bear.ts` and `lib/impact.ts`).
**Why this matters:** they implement the same product. Judging is a two-minute walk-up and
the repo rule is "one narrow path that works end to end". A decision on which backend the
demo runs against should be made well before Sunday 09:00, not discovered at the table.
**Not yet decided.** Raised by Claude 29 Aug ~14:50.

### Sat 15:00 — Split settled: web/ owns bins, verification, measurement, identity
`backend/` keeps the chatbot (LangGraph, as Dom asked), plus points, groups and the pet.
**Why:** `web/` already had 13,006 real NEA bins from data.gov.sg, Claude vision photo
verification, a baseline/arms/D30 impact model, and guest-first sessions. Rebuilding any
of it in `backend/` would be duplicated work that scores nothing.
**Cancelled in backend:** Step 8 (impact metrics), Step 9 (vision verification).
**Still unreconciled:** web uses TEXT uuid user ids, backend uses INT; web models social
as friendships, backend as groups with a shared pet. One of those mechanics has to go.
Detail in `backend/planning/03-architecture-split.md`.

### Sat 15:05 — Chatbot uses Claude, not OpenAI
**Why:** no OpenAI key exists in the project; `web/` already uses `@anthropic-ai/sdk`.
One `ANTHROPIC_API_KEY` now serves both codebases. Removed `langchain-openai` and `openai`.

### Sat 15:10 — WARNING: no working API key in the project
`ANTHROPIC_API_KEY` is set in the shell but returns **401** from the API, and there is no
`web/.env` — only `.env.example`. Right now `web/api/validate` returns `stubbed: true`,
`web/api/chat` serves its fallback, and `backend/chat` answers from its knowledge base.
**Action needed before judging:** put a real key in `web/.env` and `backend/.env`, or
decide deliberately to present the demo as offline. Every path degrades honestly and
reports which mode it is in, so offline is defensible — but it should be a choice.

### Sat 15:30 — backend/ narrowed to the chatbot; everything else deleted
`web/` now owns identity, bins, verification, measurement, social, pet, submission and
leaderboard. `backend/` is the LangGraph recycling chatbot and nothing else: `POST /chat`,
`/health`, `/`.
**Why:** two implementations of the same product was the failure mode our own repo rules
warn about, and `web/` was ahead on every one of those concerns (13,004 real NEA bins,
Claude vision verification, a baseline/arms/D30 impact model, guest-first sessions, and a
UI). Dead code left lying around gets wired up by mistake at 3am.
**Deleted:** all 8 SQLModel tables, the database layer, users/bins/recycle/activities/
groups routers, points ledger, heuristic verifier, storage abstraction, QR sticker
generator, seed and reset scripts, and 117 of the 150 tests.
**Recoverable:** everything is in commit `1981459` — `git show 1981459:backend/<path>`.
Committed deliberately before deleting so nothing was lost irreversibly.
**Consequence:** the service is now stateless — no DB, no migrations, no seeding. Test
suite went from 24s to 0.06s. Dependencies dropped from 18 to 11.
**QR sticker generator dropped for good** (Dom, 15:45): not ported to web's scan URLs.
Nothing in the repo now produces a printable QR. The underlying conflict is still open —
web's `/scan/{id}` consumes a single-use instance, so a sticker glued to a bin works once.
