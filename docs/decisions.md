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
## Learn tab cut (Sat 29 Aug, ~17:00)

The news feed is gone — tab, `/news`, and the `/prototypes/learn` surface that existed to
choose its design. This finishes the reasoning already in the build order above: it was P4
because "the brief says information is not the problem". A tab that does the one thing the
brief says does not work was costing a sixth of the nav bar and a judge's attention. Five
tabs now: Nanuq, Bins, Ask, Group, Impact.

Recoverable from git if it turns out to be wanted.

## One type scale, two insets (Sat 29 Aug, ~17:00)

The app had **28 distinct font sizes** across 125 usages — `0.9`, `0.92`, `0.95`, `0.98` and
`1rem` all coexisting, differences too small to read as intent but enough that nothing lined
up. Labels did one job at four sizes (8/9/10/11px), and 8px is not legible on a phone held at
arm's length in a corridor.

Now eight steps in `@theme`, named for their job (`label`, `micro`, `meta`, `body`, `sub`,
`head`, `title`, `mega`), so a screen picks a role and the scale picks the number. `body` is
16px: the floor below which iOS zooms the viewport on input focus.

Indentation was the worse half. The page gutter is 1rem, but card insets ran `px-2` through
`px-6` — seven values, so the first character of every screen landed somewhere new as you
moved between tabs. Two steps now: `.pad` (1.25rem) and `.pad-tight` (0.875rem/1rem) for dense
rows. Pill buttons keep `px-6`, inputs take `px-4`; those are component padding, not indentation.

One deliberate exception, marked in the file: the scan screen's `h1` stays one step down. It is
a bin address that can run long, and that screen is the one-handed path at the bin — the camera
button has to stay above the fold.

## A QR per bin, and no cluster bubbles (Sat 29 Aug, ~18:00)

**Every bin has its own QR.** The code is derived from the bin's coordinates and postal code,
never from its index in `bins.json`. A sticker is printed once and then outlives the data
behind it: the dataset is rebuilt from NEA's feed, and an index-based code would mean one
upstream insertion silently repoints every sticker in Singapore at the wrong bin. Verified
collision-free across all 13,004 — the 102 repeats are the same physical spot listed twice
by NEA, which is the correct answer for them.

This replaces the one-time scan *instance*. That model assumed a screen could mint a fresh
slot per scan; a sticker glued to a bin lid cannot. The QR now names the bin, and the replay
defence is the content hash that already stops the same photo being logged twice. This is
worth being honest about in the demo: the QR proves someone had the bin's code, not that they
were standing at it. Rotating codes or a location check would prove presence. We did neither.

Error correction is Q rather than the default M, because the sticker lives outdoors and will
be rained on and scuffed before anyone points a camera at it. Black on white, never themed —
a low-contrast QR is one that fails in a dim lift lobby, which is exactly where it is used.

**The cluster bubbles are gone.** Every bin in view is now its own dot, drawn on canvas rather
than as SVG paths. Two things had to change to make that affordable: the map payload became a
tuple of `[code, lat, lng, kind]` instead of a full bin object, which took an island-wide pan
from 196KB to 38KB, and the rest of a bin is now fetched only for the one that gets tapped.
Above 1,200 in view the response is sampled by an even stride — never the first N, which would
land in whichever town NEA listed first — and the map says how many of how many it is showing
rather than quietly displaying a fraction.

## Making the camera path survive a real phone (Sat 29 Aug, ~19:00)

The whole path was verified end to end — validate returns a verdict and a media hash, the log
awards 10 for a verified action and 5 more for the right stream, the same photo is refused
twice, and the action is attributed to the scanned bin. Four things needed fixing first.

**Photos are downscaled before upload.** The camera hands over a 12MP JPEG, roughly 4MB, which
is 5.5MB once base64 in a JSON body. The validator asks the model for `detail: "low"`, which
downsamples to about 512px at the far end, so every byte above 1024px on the longest edge was
paid for twice: on the venue wifi during a live demo, and on the API bill. EXIF orientation is
applied at the same time — without it a portrait photo reaches the model on its side, which is
a good way to have a real bin scored as unrecognisable.

**The validate call has a 45s timeout.** A spinner that never resolves is worse than a message
you can act on.

**Seeded demo history now scores.** A new user had six actions and a three-day streak sitting
next to zero points and a level-one cub. XP is the sum of the ledger, so history without point
transactions never happened as far as the bear is concerned. Those actions were also attributed
to `tpe-826a`, an id that stopped matching anything the moment bins got real codes.

**Private IPs get http in QR codes.** The origin check listed 192.168 and 10., and the machine
hands out 172.31.38.250 — inside 172.16/12, private, and missed, so a phone would have been
sent to https on a dev server that speaks only http. Any bare IPv4 is now treated as direct;
a proxy's `x-forwarded-proto` still wins where there is one.

The camera itself uses `<input type="file" accept="image/*" capture="environment">`, which
opens the rear camera through the OS picker. That needs no HTTPS — unlike `getUserMedia` — so
it works over plain http on the LAN, which is what makes a phone test possible at all.

## The map reads as one thing at a time (Sat 29 Aug, ~20:00)

With clustering gone the dots had a single fixed style, which meant the same mark was doing two
different jobs badly. Zoomed out there are over a thousand and nobody is picking one out — they
are showing where Singapore recycles, and at 6px with a dark rim and full opacity they piled up
into a rash of bright blobs. Zoomed in there are a few dozen, each a place you might walk to.

Size, stroke and opacity now follow zoom: 2.6px unstroked at 60% out at island level, where they
overlap into density; 6.5px with a rim and full opacity from estate level in, where each is a
destination. The rendering moved to an explicit canvas renderer with 8px of hit tolerance, so a
small dot is still a tappable dot — a tap that lands on nothing reads as the app being broken
rather than the user having missed.

Tiles dropped to 82% opacity so the app's own ground shows through and the bins are the
brightest thing on screen. The tiles are reference; the data is the subject.

The location marker became a ring instead of a filled disc — it has to be findable without
competing with what you came for. Zoom buttons are hidden on touch, where pinch already does
the job and two floating squares sit on top of the only thing the screen is for. Attribution
keeps its licence obligation but loses its plate, and the caption split in two: what you are
looking at now on the left, the credit that is always true on the right.

## Tapping a nearby bin moves the map (Sat 29 Aug, ~20:30)

The rows under "closest to you right now" carried the `press` class, so they scaled on touch
like every other pressable thing in the app — and did nothing. An affordance that lies is worse
than no affordance.

Tapping one now flies the map to that bin at zoom 17, opens its card, and scrolls the map back
into view. That last part is the one that is easy to miss: the list sits below the map, so
moving the map without scrolling to it is indistinguishable from the tap having failed.

The bin flown to is drawn larger with a white rim. Without it the map has moved and the user is
looking for which of forty dots they asked for. White rather than a third colour — the two fills
already mean recycling and e-waste, and a third hue would be a third thing to learn.

Zoom 17, not the maximum: close enough that the bin is unambiguous, far enough that the street
it stands on is still readable, which is what someone about to walk there needs. `flyTo` becomes
an instant `setView` under reduced motion, and the scroll follows the same preference. The rows
are real buttons now, so they work from a keyboard and announce themselves.

## The group page became a leaderboard (Sat 29 Aug, ~21:30)

Ranked on points, because points are what a scan produces: 10 for a verified action, 5 more for
the right stream, 25 every seventh day. The rule is stated in one line above the board — a score
whose origin is unexplained reads as arbitrary.

**Ties share a rank.** Two people on 240 points are both 2nd and the next is 4th. Inventing an
order between equal scores is arbitrary, and the person who lost the coin flip can see that it
was one. Sort falls through points → streak → name, so the list never reshuffles between renders.

**The bear stays on every row**, next to the score. This is the tension worth naming: the app's
thesis is that points are not the reward, the bear is — and a leaderboard pulls the other way.
Keeping the animal in the row is how both survive. The number says who is ahead; the bear says
how they are actually doing, including when someone at the top of the board has a floe that is
melting.

## UI sharpening pass (Sat 29 Aug, ~22:00)

**Keyboard focus was invisible.** No `:focus-visible` styling existed anywhere, and on a dark
ground the browser default ring is close to unreadable — anyone navigating by keyboard or switch
had no idea where they were. Now a 2px `--ice` outline with 2px offset, scoped with `:where()` so
it costs no specificity, plus a rule for Leaflet's own controls, which sit outside the app's DOM.
An outline rather than a shadow, because this app has no shadows. `:focus-visible` rather than
`:focus`, so a mouse press does not leave a ring behind.

**The scan verdict was announced to nobody.** It is the answer to the only question that screen
asks, and it appeared silently. It is now an `aria-live="polite"` region — polite rather than
assertive, so it follows what the user is doing instead of interrupting. Its error also gained
`role="alert"`, which login and group already had; the most important error surface in the app
was the one without it.

**Radii collapsed to two.** `rounded-lg` on two inline notes and one hand-picked `rounded-[1.7rem]`
card sat among a UI of `rounded-2xl` and `rounded-full`. Now 11 × `2xl` and 34 × `full`, nothing
else. Loading skeletons likewise ran at three different opacities for one job; all are 50% now.

Checked and found already sound: no `transition: all`, every tap target at or above the 44px
floor, decorative SVGs hidden from assistive tech, images captioned, errors and the chart already
carrying live regions.

## The chat tab is a client of the Python service, not a second chatbot (Sat 29 Aug, ~22:00)

`web/src/app/api/chat/route.ts` was a system prompt and one `chat.completions.create`. The
service in `fastAPI_chatbot/` was retrieval over a curated NEA knowledge base, a place-name
geocoder, a search across the same 13,004 bins the map draws, and a ground check on the
finished answer — with nothing calling it. Two chatbots, one of them better and unreachable.

The route is now a proxy. All the logic stays in Python; `web/src/lib/chatbot.ts` holds the
types and the URL, and is the only file in the app that knows the service exists.

**The reply is no longer a string.** It carries the sources it drew on, the collection points
it found, whether it was grounded and whether a model wrote it — and the UI shows all four.
An assistant that says "e-waste point, 362 m away, here are directions" with an NEA citation
under it is a different claim from one that says "e-waste, probably", and a judge should be
able to see which one they got without asking us.

Two things follow from that, both about not overstating what we have. A source whose snippet
is our own summary of public guidance is labelled *further reading*, not quoted as NEA's
words. And an ungrounded answer is marked on screen as a guess.

**The fallback is deliberate and it is visibly worse.** If the Python service is not running
— one forgotten terminal at a judging table — the route answers with a single ungrounded
model call and says so in the reply. The alternative was a chat tab that dies when a second
process does, which is a worse thing to discover at 12:30 on Sunday. But a degraded answer
that looks identical to a good one would be worse still, so it does not.

`GET /api/chat/health` reports whether the service is up and what it loaded, so that is one
curl before judging rather than a discovery mid-question.

## Every turn is answered against the whole conversation (Sat 29 Aug, ~23:00)

The frontend was already sending the full transcript. The graph was throwing most of it away.

`contextualize` only looked at the single previous **user** message, and only when a keyword
heuristic fired — a list of openers like "what about" and a handful of bare pronouns. So
"is that the same place I take the batteries?" three turns after the laptop question resolved
against the wrong turn, and "does the same rule apply to a used paper cup?" matched no keyword
at all and went to BM25 as-is. And `generate` never saw the conversation, only the rewritten
query, which made "how far did you say that was?" unanswerable in principle.

Now: the first message of a session skips contextualization, because there is nothing to
resolve it against. **Every message after it is rewritten against the transcript**, heuristic
removed — it could only ever catch the follow-ups someone thought to list, and the failure is
silent. `generate` gets the prior turns ahead of the reference block.

The window is ten messages. Place-name lookup still scans the entire history unwindowed —
someone who said "I'm at Raffles Hall" in message one should not have to repeat it.

**The heuristic survives on the offline path**, where there is no model to rewrite with and
joining questions is the only tool available. Joining is lossy — the earlier question's terms
outscore the current one — so it stays gated to messages that genuinely cannot stand alone.

The system prompt now separates the two kinds of context explicitly: reference material is the
only source for disposal facts, earlier turns are only for knowing what the person means and
what they have already been told. Without that line the model can launder its own earlier
answer into a new one that retrieval no longer supports — the ground check would catch it, but
after the fact.

The cost is one extra ~60-token call on every turn after the first. That is the price of the
feature, and it buys the difference between a chat and a series of unrelated questions.

## A refresh button, because a demo runs many times (Sat 29 Aug, ~23:15)

Judging is a walking format: the same conversation gets started a dozen times in two hours,
and the previous judge's questions must not be in the context of the next one's.

**It clears the coordinates too.** Someone starting a new session may have walked somewhere
else, and silently reusing a position from ten minutes ago sends them to a bin that is no
longer nearest — a wrong answer with no visible cause. The next location question re-asks.

Top-right, and deliberately far from the send button at the bottom of the screen. A thumb
reaching to ask a question should never be able to land on "erase everything". It appears
only once there is something to clear.

## Vercel: what it takes, and what it costs (Sat 29 Aug, ~23:15)

`next build` passes and every route compiles, so the only blocker is the database. Vercel's
filesystem is read-only outside `/tmp`, so `mkdirSync` in `db.ts` throws on the first request
that touches SQLite — it crashes rather than merely forgetting, taking out signup, login,
logout, profile, username check, groups and `/api/log`.

`DB_PATH` now resolves to `/tmp/floe.db` on Vercel, `FLOE_DB_PATH` if set, and the real file
locally. That makes a deploy survive rather than 500. It is honestly a preview, not a demo
target: `/tmp` is per-instance, so an account created on one request can be gone on the next.

**What works on Vercel:** the map and all 12,902 bins, QR generation, the photo validator, the
impact page, and chat — the last one degraded, because `/api/chat` falls back to a direct model
call when the FastAPI service is unreachable, which it always is from Vercel.

**The permanent fix** is a hosted database behind `repo.ts`, which was built as the single
swappable data layer. Turso/libSQL is the closest fit. The cost is that every hosted DB is async
while `node:sqlite` is sync: 30 exported functions and ~70 call sites across 7 files gain
`await`. Roughly 60–90 minutes, with the risk landing on login and points. Deferred, not
rejected — the judged demo runs off the tunnel against a real database.

## The demo runs in two places (Sun 30 Aug, ~01:00)

Vercel serves the public app; the laptop serves anything with an account behind it.

Reproduced on the deployment: two consecutive requests returned two different users — claim
succeeded as one id, `/api/auth/me` came back a fresh guest, and creating a group then 403'd
with "claim a username first". The group page was right to show the claim screen; the account
had genuinely ceased to exist. The identical flow is clean on localhost.

The cause is `/tmp` being per-instance on Vercel, which is what `db.ts` falls back to because
the rest of the filesystem is read-only. Signup appears to succeed and then silently
un-happens, which is worse than not offering it.

So: printed stickers point at Vercel, because a judge scanning with their own phone needs no
laptop and that is the strongest moment in the demo. The streak, the bear's growth and the
leaderboard are shown on the laptop against the real database. Chat is grounded there too,
since the knowledge service runs locally.

Chosen over swapping to a hosted database (Turso, ~60-90 min across 30 functions and 70 call
sites) because it was 01:00 and the risk landed on login and points — the two things that must
not break in front of a judge. The swap remains the right permanent fix.
