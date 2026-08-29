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

## Target device: phone and tablet, not desktop

**Floe is a mobile web app.** Judges will see it on a phone, and the core interaction is a
student standing at a bin with one hand free. Design and test at phone width first;
desktop is a courtesy, not the target.

This is not a preference — it follows from the mechanic. The QR is scanned by a phone
camera, the photo is taken on a phone, and the whole loop is meant to take ten seconds
one-handed in a corridor.

Practical rules:
- Design at ~390px wide (iPhone) and check ~820px (iPad). The layout is capped at
  `max-w-lg` and centred, which holds on both.
- **Thumb reach matters.** Primary actions belong low on the screen, not at the top.
- Touch targets ≥44px. No hover-only affordances — there is no hover on a phone.
- Text must be readable at arm's length in a bright corridor; avoid low-contrast greys
  for anything load-bearing.
- Test in a real mobile viewport, not a narrowed desktop window — `capture="environment"`
  on the camera input only does anything on a real device.

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
