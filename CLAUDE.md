# NUS LifeHack 2026 — team entry

Team: `domjcwl`, `infernoxthecat`, `zerethkit`, `raviharikkrishna`
Broad topic: **sustainability**. Actual problem statements released 11:00 Sat 29 Aug.

## The two clocks that matter

| | |
|---|---|
| **Sat 11:00** | Problem statements released. Build starts. |
| **Sun 11:00** | **Devpost submission form LOCKS. Late submissions are not judged.** |
| Sun 12:00–14:30 | Judging, **walking format** — judges come to our station |

Venue access ends 18:00 Saturday (move to SR1 / LT38 after).

Treat Sunday 09:00 as the real deadline, not 11:00. The last two hours are for README, demo
video and submission — not for building.

## Standing rules for this repo

1. **Demo-ability beats completeness.** Judging is a live two-minute walk-up. One narrow path
   that works end to end always outscores a broad feature set that half-works. When in doubt,
   cut scope and make the remaining path bulletproof.
2. **Vertical slice first.** Get one thin path working from UI through to data, commit it, and
   only then broaden. Never build three half-layers in parallel.
3. **Commit early and often, push often.** Four people are on `main`. Always
   `git pull --rebase` before pushing — it keeps history linear and avoids untangling merge
   commits at 3am.
4. **No secrets in the repo.** It is public. Use `.env` (git-ignored) and keep a committed
   `.env.example` listing the variable names.
5. **Record attribution as you go.** Every third-party API, dataset, library, template or
   pre-existing asset goes into the README's Acknowledgements section *at the moment it is
   introduced*, never retrofitted on Sunday morning. This is a hard competition rule, not
   politeness — see `docs/lifehack-brief.md`.
6. **The repo must be runnable by a stranger.** A judge must be able to follow the README and
   start the project. Keep setup instructions accurate as the stack changes.

## Where things live

- `docs/lifehack-brief.md` — all event facts, rules, submission requirements. **Single source of
  truth. Do not re-research the event; read this.**
- `docs/sustainability-primer.md` — domain background, Ecovolt research, data sources, and the
  metrics judges in this space tend to probe.
- `docs/decisions.md` — running decision log. Append, don't rewrite.
- `docs/plugin-shortlist.md` — one-line installs to run once the brief is known.
- `.claude/skills/` — `brief-triage`, `hack-scaffold`, `demo-prep`, `submission-checklist`.

## Stack

**Not yet chosen** — deliberately deferred until the briefs are known. See
`.claude/skills/hack-scaffold/SKILL.md` for the verified setup commands once it is picked.

Constraint: **Docker is not installed** on Hari's machine. Avoid stacks that need it.
