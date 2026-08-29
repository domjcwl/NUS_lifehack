---
name: demo-prep
description: Use Sunday morning before judging (12:00-14:30, walking format) to prepare the station demo, the two-minute script, seeded data and offline fallbacks. Also useful Saturday evening to sanity-check that the demo moment is visible.
---

# Demo prep — walking format

Judging is **12:00–14:30 Sunday**. Judges walk to our station. We stay with our setup for the
whole window. This is not a stage pitch — it is the same two minutes delivered many times to
different people, some of whom work at the partner company that wrote the brief.

Optimise for: **a judge who arrives knowing nothing, gives you 2 minutes, and is standing up.**

## The two-minute script

Rehearse it out loud. Everyone on the team should be able to deliver it, because judges arrive in
parallel and you cannot rely on one person.

1. **The problem, in one sentence** (15s). Concrete, named user. Not "sustainability is
   important" — "Facilities managers can see the building's total bill but cannot tell which
   rooms are wasting it."
2. **The demo moment** (60s). *Show, do not describe.* Get to the thing that works within 30
   seconds of starting. Do not narrate architecture while the judge waits for something to
   happen.
3. **How it works** (30s). Just enough technical substance to prove it is real — the actual
   mechanism, not a buzzword list.
4. **What is real vs. simulated** (10s). Say it plainly and unprompted. Judges assume simulation
   in a 24h build; volunteering it buys credibility, and being caught not saying it destroys it.
5. **What is next** (5s). Your cut list from `brief-triage` is exactly this, for free.

Then stop and let them ask. The questions are where the score is actually made.

## Before judging opens

- [ ] **Seeded demo data loaded.** Never type input live — typos, latency and empty states have
      ruined more demos than bugs.
- [ ] **Happy path rehearsed end to end at least 3 times**, on the machine that will be used.
- [ ] **Browser tabs pre-opened**, zoom set so a standing judge can read the screen. Increase
      font size — laptop default is too small to read over someone's shoulder.
- [ ] **Notifications off**, Slack/Discord/email quit, screen sleep and OS updates disabled.
- [ ] **Charger plugged in.** Two hours of continuous demoing drains a laptop.
- [ ] **Reset procedure** — a one-command way to return to the clean starting state between
      judges. You will need it a dozen times.
- [ ] **Someone owns the laptop.** One driver, others answer questions.

## Fallbacks — assume something breaks

Venue wifi during judging is the classic failure. Prepare, in order:

1. **Recorded screen capture of the working demo** (60–90s), saved **locally**, not on a cloud
   link. This is also a submission asset — record it Sunday morning, not at 11:55.
2. **Screenshots** of the key screens, in a folder, ready to open.
3. **Local-only mode** — if it depends on a hosted API, have a mocked/offline path with a flag.
4. **Phone hotspot** as network backup.

If something breaks mid-demo, say so calmly, switch to the recording, and keep talking. Judges
have seen it many times; panicking is what costs marks, not the failure.

## Questions to expect

Have crisp answers ready. Domain judges from the partner probe hard.

- "Where does this data come from?" — be honest about simulated vs. real.
- "What are the actual numbers?" — kWh, cost, CO₂. See `docs/sustainability-primer.md` for the
  Singapore grid factor and tariff figures, and **cite the source of any number you use**.
- "How is this different from what already exists?" — know the incumbent. If the partner already
  sells something in this space, know what it does and where yours differs.
- "What did you build in 24 hours vs. what was pre-existing?" — the rules require this
  disclosure; answer it comfortably.
- "Would this actually scale / work in a real building?" — name the real constraint honestly
  rather than overclaiming.
- "What would you do with another week?" — the cut list.

## Station setup

- Project title visible — a laptop lid sticker, a sheet of paper, anything. Judges are matching
  you to a list.
- One-line description on screen or paper, so a judge waiting behind another team can orient.
- Have the repo open in a second tab — judges sometimes ask to see code, and a clean README is a
  strong signal.

## The honesty rule

Never claim a number, integration or capability you cannot show. A judge who catches one
overclaim discounts everything else you said. "That part is simulated, here is what would replace
it in production" is a *stronger* answer than a vague implication that it is real.
