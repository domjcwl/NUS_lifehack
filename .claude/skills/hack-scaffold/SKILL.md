---
name: hack-scaffold
description: Use right after brief-triage to stand up the project skeleton fast and set the four-person working conventions. Covers the candidate stacks, the vertical-slice rule, and how to parallelise without merge conflicts.
---

# Hack scaffold

Goal: from "we picked the brief" to "a thin path works end to end and is committed" in **90
minutes**. Everything else follows from that.

Constraint: **Docker is not installed.** Avoid stacks that need it.

## The rule that matters most: vertical slice first

Build one thin path all the way through — UI → API → data → back to UI — with fake data if
necessary, and **commit it**. Only then broaden.

Do not build three half-layers in parallel. Four people each building a layer that has never
talked to another layer is the reliable way to arrive at 04:00 with nothing that runs.

Once the slice works, widening it is safe and parallelisable, and you always have something
demoable. If the event ends early or something breaks, you still have a demo.

## Stack options

Pick one. Do not hedge; hedging costs an hour.

### A. Next.js + TypeScript + Tailwind (default for most briefs)
Everything in one repo, API routes for backend logic, deploys to Vercel in a minute.
```
npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --use-npm
cd app && npm run dev
```
Add shadcn/ui only if you need real components — it is fast, but skipping it is faster:
```
npx shadcn@latest init && npx shadcn@latest add button card input table
```

### B. Vite React + FastAPI (pick if the brief is ML/CV/data-heavy)
```
npm create vite@latest web -- --template react-ts && cd web && npm install
```
```
python -m venv .venv && .venv/Scripts/activate
pip install fastapi "uvicorn[standard]" pydantic python-dotenv
uvicorn main:app --reload --port 8000
```
Set the Vite dev-server proxy to `http://localhost:8000` immediately — CORS debugging at 2am is
a waste of the night.

### C. Next.js + FastAPI
Only if you genuinely need both a polished web UI and real Python. Two processes, more setup,
more that can break. Justify it before choosing it.

## Data layer

Reach for the simplest thing that survives the demo:
- **In-memory / JSON file** — fine for a 24h prototype, zero setup, and it never fails live.
- **SQLite** — if you need queries. Still zero infrastructure.
- **Supabase / Convex / Neon** — only if you need multi-user, auth, or realtime. Costs 20–30
  minutes of setup; make sure you need it.

A judge cannot see your database. Do not spend demo-critical time on persistence you will not
show.

## Seed data early

Whatever the domain, write a seed script in the first two hours that populates realistic data.
The demo must never depend on typing input live, and you need something to build the UI against.
For sensor/energy data, simulate daily and weekly cycles plus noise — see
`docs/sustainability-primer.md`.

## Four-person parallelisation

We are four people on one `main`. Conventions:

1. **Agree file ownership at the start.** Two people editing the same component is the main
   source of conflicts. Split by feature area, not by layer.
2. **Branch per person**, short-lived: `feat/<name>-<thing>`. Merge to `main` several times a
   day, not once at the end.
3. **Always `git pull --rebase` before pushing.** Keeps history linear.
4. **Commit small and often.** A 40-file commit at 03:00 cannot be reviewed or reverted.
5. **`main` must always run.** If it is broken, that is the only priority until it is fixed —
   everyone else is blocked and the demo lives on `main`.
6. **One person owns integration.** Someone whose job is that the pieces fit together, not a
   feature of their own.

## First hour checklist

- [ ] Skeleton runs locally, committed and pushed
- [ ] `.env.example` committed with variable names (never real values — repo is public)
- [ ] README started: what it is, how to run it. Update as you go, not on Sunday
- [ ] Riskiest assumption from `brief-triage` tested — does the API/data/model actually work?
- [ ] Everyone can clone, install and run it. **Do this before splitting up**, or you will find
      out at 22:00 that it only works on one laptop
- [ ] Seed/demo data script exists

## Hour-by-hour sanity checks

- **T+3h (14:00)** — vertical slice works end to end? If not, cut scope now.
- **T+8h (19:00)** — is the demo moment visible yet? If not, cut scope now.
- **T+16h (03:00)** — feature freeze. Anything not working now gets cut, not fixed.
- **T+22h (09:00)** — hands off features entirely. Switch to `submission-checklist`.
