---
name: submission-checklist
description: Use from 09:00 Sunday, two hours before the 11:00 Devpost lock. T-minus runbook for the README, repo hygiene, third-party disclosure, demo video and the Devpost form. The deadline is hard - late submissions are not judged.
---

# Submission checklist

**The Devpost form locks at 11:00 Sunday. Late submissions are not judged.** There is no appeal
and no grace period. Treat 10:30 as the deadline and keep 30 minutes of buffer.

Start this at **09:00 Sunday**. Features are frozen from that point — anything not working is
cut, not fixed.

## T-minus runbook

### 09:00 — Freeze and split
Stop building. Split the team: two people on submission assets (README, video, Devpost), two on
making the demo path bulletproof. Nobody starts a new feature.

### 09:00–09:30 — Repo hygiene
- [ ] Everything committed and **pushed** to `origin/main`
- [ ] Repo is **public** and the URL is correct
- [ ] **No secrets committed** — scan for keys and tokens. `git log -p | grep -iE "api[_-]?key|secret|token|password"`. If something leaked, rotate the key; rewriting public history is not reliable
- [ ] `.env.example` present with variable names, no values
- [ ] Repo is small enough to clone quickly — no stray model weights or datasets

### 09:30–10:00 — README (this is a hard requirement)
The rules require the repo to **contain instructions explaining how to run or evaluate the
project**. This is graded, not optional.

- [ ] **What it is** — one paragraph, plain language, the problem and the solution
- [ ] **Which challenge statement** it addresses, named explicitly
- [ ] **How to run it** — exact commands, from a fresh clone. Prerequisites and versions
- [ ] **Environment variables** needed, and how to obtain them
- [ ] **A screenshot or two** — the first thing a judge sees
- [ ] **Demo video link**
- [ ] **Team members**, all four
- [ ] **Acknowledgements** — every third-party library, API, dataset, template and asset, plus
      **any pre-existing code, clearly disclosed**. This is an explicit competition rule
- [ ] **Test the instructions.** Have a teammate clone into a fresh folder and follow the README
      literally. This catches the missing step every single time

### 10:00–10:30 — Demo video
- [ ] 60–90 seconds, screen recording of the working happy path
- [ ] Show the demo moment in the first 20 seconds
- [ ] Uploaded (YouTube unlisted is the safe default) and the **link tested in a private window**
- [ ] Keep a **local copy** — it is also the judging-day fallback (see `demo-prep`)
- [ ] Confirm any length or hosting rules announced at the briefing

### 10:30 — Devpost submission
- [ ] **One submission for the team** — do not create several
- [ ] **All four members listed** — `domjcwl`, `infernoxthecat`, `zerethkit`, `raviharikkrishna`.
      A member not listed may not be credited
- [ ] Correct challenge statement / track selected
- [ ] Project description filled — reuse the README opening
- [ ] Repository URL, demo video, screenshots attached
- [ ] Every required field completed — **incomplete submissions may be excluded**
- [ ] **Submit.** You can usually keep editing after submitting, so submit early and refine.
      An early imperfect submission beats a perfect one at 11:01

### 10:45–11:00 — Verify
- [ ] Open the submission in a **private window** — confirm it is publicly visible
- [ ] Confirm the repo link works when logged out
- [ ] Confirm the video plays when logged out
- [ ] Screenshot the confirmation as proof of on-time submission

## Then go to `demo-prep`

Judging starts at 12:00. Use the gap to set up the station and rehearse the two-minute script.

## Failure modes that actually happen

- **Repo left private** — judges cannot open it, and it is a stated requirement.
- **README written from memory** — the setup step everyone forgot is the one that was done on day
  one. Test from a fresh clone.
- **A member missing from the submission** — they may not be credited at all.
- **Video uploaded but still processing** at 10:58. Upload early.
- **Secrets committed** in a public repo.
- **Everything left to the last 30 minutes**, and the wifi is saturated because 40 teams are
  uploading video simultaneously. This is the single most common way teams miss the lock.
