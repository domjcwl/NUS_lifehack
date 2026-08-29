---
name: brief-triage
description: Use at 11:00 when the LifeHack challenge statements are released, to choose which brief to build and scope the MVP. Forces a decision within 30 minutes and produces an explicit cut list.
---

# Brief triage

The single highest-leverage 30 minutes of the event. A mediocre idea chosen at 11:20 beats a
great idea chosen at 13:00, because the deciding constraint is build time, not idea quality.

**Hard rule: the decision closes by 11:30.** If the team is still debating at 11:30, take the
highest-scoring option and move. Reopening the choice later costs more than being slightly wrong.

## Inputs

Paste in all five challenge statements verbatim, plus the judging criteria announced at the
briefing. Read `docs/sustainability-primer.md` for domain context. Our broad topic is
sustainability, so the Ecovolt-adjacent brief is the prior — but do not auto-select it if another
brief scores clearly higher.

## Process

### 1. Record the criteria first (5 min)
Write the **actual announced judging criteria and weightings** into
`docs/lifehack-brief.md`. Everything downstream is scored against these, not against a guess.
If creativity is weighted heavily, an unusual angle matters more than polish; if technical depth
is weighted, the reverse.

### 2. Score each brief (10 min)

For each of the five, score 1–5 and write one line of justification. Do not skip briefs that look
unappealing — the reason a brief looks unappealing is often that it is under-contested.

| Axis | Question | Why it matters |
|---|---|---|
| **Feasible in 24h** | Can 4 people ship a working prototype of the core loop by 09:00 Sunday? | The most common failure is over-scoping on hour one. |
| **Demos in 2 minutes** | Can a judge *see* it work at our station without setup or explanation? | Judging is a live walk-up. Invisible cleverness scores zero. |
| **Team fit** | Do we already know the tools this needs? | 24h is no time to learn a framework. |
| **Under-contested** | Will 15 other teams build the obvious version of this? | Being the 12th smart-bin project is fatal. |
| **Inputs exist** | Does the data/API/hardware actually exist and work today? | "We'll find a dataset" has killed many projects. |

Weight **Feasible** and **Demos** highest. They are the two that teams systematically
underestimate.

### 3. Sanity-check the top choice (5 min)

Ask, honestly:
- What is the **demo moment** — the single thing we show that makes a judge nod? If you cannot
  name it in one sentence, the project has no spine yet.
- What is the **riskiest assumption**? Test it in the first hour, not hour twelve.
- If everything goes wrong, what is the **degraded version** we can still show?
- Are we solving a real problem the partner named, or a problem we find interesting? Judges from
  the partner company will notice the difference immediately.

### 4. Commit to scope (10 min)

Write into `docs/decisions.md`:

- **Chosen brief** and one-line reason.
- **Problem statement in one sentence** — "For [user], who [problem], we build [thing] that
  [outcome]." If it takes more than a sentence, the scope is still too big.
- **The demo moment**, in one sentence.
- **MVP** — the smallest set of features that makes the demo moment work end to end. Aim for
  something that feels uncomfortably small; it will grow on its own.
- **The cut list** — explicit things we are choosing NOT to build. Write these down. The cut list
  is what stops the 02:00 conversation "should we add auth?" It also becomes the "future work"
  slide, which is free credit.
- **Owner per workstream** for the four of us.

### 5. Assign and start
Hand off to `hack-scaffold` to stand up the skeleton. First commit within 30 minutes of the
decision.

## Output format

```
CHOSEN: <brief> — <one-line why>
PROBLEM: For <user>, who <problem>, we build <thing> that <outcome>.
DEMO MOMENT: <the one thing we show>
MVP: 1. … 2. … 3. …
CUT (not building): …
RISKIEST ASSUMPTION: … → test by <time>
OWNERS: dom=… inferno=… zereth=… hari=…
```

## Anti-patterns

- **Picking the most technically interesting brief.** Interesting ≠ demoable ≠ winnable.
- **Building a dashboard.** See `docs/sustainability-primer.md` — the default sustainability
  project visualises data and shows no decision. If you build one, make it answer "so what do I
  do now?" on the same screen.
- **Deferring the scope cut.** "We'll see how far we get" reliably produces four half-features
  and no demo.
- **Choosing a brief whose data does not exist yet.** Verify the input in the first hour.
