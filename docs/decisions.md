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

### Sat 13:45 — No authentication in the backend
Dropped JWT, login and password hashing. Callers identify themselves with `?user_id=` or an
`X-User-Id` header.
**Why:** the ceremony was friction with no payoff for a two-day build. Trigger was a real
symptom — Swagger pre-filled the register example, so the pre-filled body only ever worked
once and looked like a broken endpoint. Trade-off was stated (anyone can act as anyone, so
"one submission per user per bin" is forgeable) and accepted: verification here is a game
mechanic, not a security control.
**Contained in:** `backend/app/core/deps.py` only — every router depends on `CurrentUser`
and not on how identity was established.
**Revisit if:** a judge asks about account integrity, or the frontend needs real sessions.
Restoring it is one file — steps in `backend/planning/02-auth-decision.md`.

### Sat 14:25 — Rejected submissions do not consume the per-bin cooldown
Cooldown and duplicate-photo checks now count only `approved` activities.
**Why:** found in live testing. A blurry or blank photo was rejected (0 points) but still
started the 60-minute cooldown, locking the user out of a bin they had physically walked
to. The cooldown exists to stop farming points from one bin; a submission that earns
nothing should not consume it. Same reasoning for duplicate detection — resubmitting a
better photo of the same scene is retrying, not farming.
**Revisit if:** someone finds a way to farm by deliberately triggering rejections.
