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
