# Floe — Devpost story

Paste each section into the matching Devpost field. Markdown is supported there.

---

## Inspiration

We kept running into the same two questions, in ourselves and in everyone we asked: *is
this actually recyclable?* and *where on earth does e-waste go?* Nobody is refusing to
recycle out of malice. People stand at the bin holding something ambiguous, guess, and move
on — and a wrong guess contaminates the bin, which is worse than not recycling at all.

Every HDB lift lobby has a poster for exactly this. The posters are informative and they
still do not work, for two reasons. They are generic, so they cannot answer *your* question
about *this* object at the moment you are holding it. And there is nothing enjoyable about
them — you read a wall of rules, feel mildly lectured, and walk past. The Ecovolt brief put
the second half in one line: *"the problem is not a lack of information, it is a lack of
motivation and delight."* Our own version of that is narrower — the information exists, but
never in the shape or the second where a person could act on it.

So we did not build another way to tell people about recycling in general. We tried to
replace the poster with something that answers the question in front of you, and makes
answering it feel like something rather than nothing.

The second half of the inspiration was a correction. We started out aiming this at NUS
students and a hostel corridor, because that is the world we live in. Then we pulled NEA's
recycling-bin dataset and it moved us: the nearest blue bin to NUS in the national data is
about **1.1 km away**, against about **125 m** in Tampines. Those bins are in HDB estates.
Building a bin-anchored habit for the one population that has no bins nearby would have
been designing against our own evidence, so we changed the audience and kept the mechanic.

## What it does

Floe turns the bin itself into the interface. The whole loop takes about ten seconds,
one-handed, standing in a corridor.

1. **A code at the bin.** Every one of the 12,902 recycling points in NEA's dataset has its
   own QR. Scanning it names *that* blue bin, so the intervention lives where the decision
   happens instead of in an app you have to remember to open.
2. **One photo.** Hold the item at the bin and shoot.
3. **The model checks it.** A vision model verifies a real recyclable is really going into
   a bin, and whether the stream is right. The same photo cannot be logged twice.
4. **Nanuq responds.** The polar bear's ice floe visibly shrinks the longer you go without
   acting, and recovers when you log. You are protecting something, not collecting a badge.

Around that core loop:

- **Points feed the bear, not a dashboard.** 10 for a verified action, +5 for the right
  stream, +25 every seventh consecutive day — and every point goes into the animal growing
  visibly, from a cub at level 1 to a great bear at level 11.
- **Groups** — a block, a flat or a family — join by a six-character invite code and rank on
  a leaderboard, but everyone keeps their own bear. Loss aversion stays personal.
- **An answer to "is this even recyclable?"** — the assistant that started this whole idea.
  Ask it about the object in your hand and it replies from NEA guidance with its sources
  attached and, if you want one, the nearest collection point that takes that thing. E-waste
  is where it earns its keep: those points are sparse, most people cannot name one, and a
  generic poster has never helped anyone find the closest.
- **A nearest-bin map** over the real island-wide dataset, for the other half of the
  hesitation — knowing what to do and not knowing where.
- **An impact screen** stating a metric, a baseline, a target and a control arm — with the
  cohort figures labelled as simulated throughout, because the brief permits mocked inputs
  and does not permit presenting them as real.

## How we built it

**The app** is Next.js 16 / React 19 / Tailwind 4, designed at 390px first and checked at
820px. That is not a stylistic preference — the QR is scanned by a phone camera and the
photo is taken on a phone, so anything that only works on a desktop does not work at all.
Primary actions sit low on the screen, where a thumb reaches.

**Storage** is SQLite through Node's built-in `node:sqlite`, so there is no native module to
compile — which mattered, because the team is on Windows. Every query lives in one module,
`lib/repo.ts`, so swapping SQLite for a real backend means reimplementing one file's exports
and touching nothing else.

**Verification** is an OpenAI `gpt-4o-mini` vision call behind `/api/validate`, which returns
a verdict plus a content hash of the image. XP is the **sum of a ledger**, never a stored
counter, so every point can be explained and nothing drifts.

**The assistant** is a separate FastAPI service running LangGraph as an explicit state
machine — classify → retrieve → locate → generate → ground-check — over a BM25 index of NEA
documents. Making retrieval and the ground check into named nodes rather than one model call
is what lets an answer carry sources and a real collection point instead of a plausible
paragraph.

**The QR codes** are derived from each bin's coordinates and postal code, never from its
position in the dataset. A sticker gets printed once and then has to outlive the data behind
it: `bins.json` is rebuilt from NEA's feed, and if the code were an array index, one
insertion upstream would silently repoint every sticker in Singapore at the wrong bin.
Verified collision-free across all 13,004 rows — 102 of those are the same physical spot
entered twice by NEA, and they correctly collapse to one bin each.

Four of us worked on one `main` branch with a running decision log, so a choice made at 15:00
was still legible at 03:00.

## Challenges we ran into

**We built the same product twice.** By mid-afternoon the repo had two backends — a FastAPI
service and the Next.js app — independently implementing users, points, bins and
verification. We caught it, chose the one that was ahead on every concern, and deleted the
other's entire data layer: eight tables, five routers, the points ledger, and 117 of 150
tests. It was committed deliberately before deletion so nothing was lost irreversibly. The
reason to be ruthless was practical: dead code left lying around is what gets wired up by
mistake at 3am.

**The camera path did not survive contact with a real phone.** A 12MP JPEG is roughly 4MB,
which becomes 5.5MB once base64-encoded into a JSON body — paid for twice, once on venue wifi
during a live demo and once on the API bill, since the validator asks for `detail: "low"` and
the far end downsamples to about 512px anyway. We now downscale to 1024px on the longest edge
and apply EXIF orientation first, because without that a portrait photo reaches the model on
its side and a perfectly good bin gets scored as unrecognisable.

**A private IP nearly broke every QR.** Our origin check listed `192.168.` and `10.`, but the
dev machine hands out `172.31.38.250` — inside `172.16/12`, private, and missed. A phone
scanning a sticker would have been sent to `https` on a dev server that only speaks `http`,
and it fails silently, in a camera app, at the bin. Any bare IPv4 is now treated as direct.

**Thirteen thousand map pins.** Cluster bubbles hid the one thing the map is for — is there a
bin near me. Drawing every point individually meant shrinking the payload: the map now
receives a tuple of `[code, lat, lng, kind]` instead of a full object, which took an
island-wide pan from 196KB to 38KB, and the rest of a bin is fetched only when one is tapped.
Above 1,200 in view we sample by an even stride rather than taking the first N, which would
have landed entirely in whichever town NEA happened to list first.

**Seeded demo history that didn't count.** A new user opened the app with six actions and a
three-day streak sitting next to zero points and a level-one cub. Because XP is the sum of a
ledger, history without point transactions never happened as far as the bear is concerned —
a bug that exists *because* of a design decision we still think is right.

## Accomplishments that we're proud of

**Every path degrades honestly, and says which mode it is in.** For a stretch of Saturday we
had no working API key. Rather than fake it, we made the failure legible: without a key the
validator returns a stubbed verdict and the screen says so; without the Python service the
chat tab still answers, marked on screen as a guess with no sources and no bins. The demo
survives a dead network without ever pretending a photo was checked when it wasn't.

**We say what our own mechanism does not prove.** A printed QR proves someone had that bin's
code. It does not prove they were standing there — a static sticker can be photographed once
and reused from a sofa. The defence that actually works is the content hash, and a re-crop
defeats even that. A serious deployment would rotate a code on a small display or check the
phone's location against the bin's. We did neither, and the README says so instead of
claiming the QR is proof of presence. The same goes for the 4-digit PIN, and for the absence
of a CO₂ figure — we do not measure the mass of what goes into the bin, so we do not claim it.

**Real open government data, not samples.** 12,291 recycling points and 713 e-waste points
from data.gov.sg under the Singapore Open Data Licence, normalised by two committed scripts
that reproduce the dataset from source.

**A measurement story a judge can attack.** A named metric (verified actions per user per
week), a stated baseline method, a target, a control arm — and vanity metrics shown
separately and labelled as not the point.

**We deleted a working backend** rather than carry two. That was the hardest call of the
weekend and the one that most improved the result.

## What we learned

**Let the data pick the audience.** We had a good story about hostel corridors. NEA's dataset
said the bins are in HDB estates, and the honest move was to follow the evidence rather than
the anecdote we were attached to.

**Honest degradation is a feature, not an apology.** Building each path to announce its own
mode made the app more demonstrable, not less — and it removed the temptation to quietly fake
a result under pressure.

**Identifiers have to outlive their dataset.** An array index is the easy choice and it is
wrong the first time upstream data shifts. Deriving each code from the bin's own coordinates
cost an hour and made a printed sticker permanent.

**Two half-built layers are worth less than one that works end to end.** Judging is a
two-minute walk-up. We wrote that rule down before the event started and still had to enforce
it against ourselves at 15:00.

**Design at the phone, on the phone.** A narrowed desktop window is not a mobile viewport,
and `capture="environment"` does nothing until a real device is holding it.

## What's next for Nanuq the polar bear

**Prove presence, not possession.** Rotating a code on a small display at the bin, or checking
the phone's location against the bin's, closes the gap our QR currently leaves open.

**A perceptual hash instead of a content hash**, so a re-crop of yesterday's photo stops
counting.

**Run the study the app is already instrumented for.** The baseline, the control arm and the
day-30 retention target are designed; what is missing is thirty days and a real cohort.

**Campus, as a second phase rather than a retreat.** E-waste collection points *do* cover NUS,
so the same mechanic has a home here — it just is not the blue-bin habit.

**The unglamorous list:** rate limiting and real auth in place of a 4-digit PIN, a cooling-off
period so a retired username cannot be taken and mistaken for its previous owner, and
stream-level feedback once we can tie a verdict to NEA's contamination data.
