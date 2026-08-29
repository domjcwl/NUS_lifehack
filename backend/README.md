# BinBuddy — backend

Gamified recycling API for NUS LifeHack 2026 (Ecovolt "Small Green Habits" brief).

**The loop:** `Recycle → scan the bin's QR → submit photo proof → earn points → your group's
pet grows → your friends see it.`

---

## Quick start

Requires Python 3.11+ (verified on 3.14.6). No Docker, no database server.

```bash
cd backend

# 1. Virtual environment (one already exists at backend/venv — reuse it)
python -m venv venv
venv/Scripts/activate        # Windows;  source venv/bin/activate on macOS/Linux

# 2. Dependencies
pip install -r requirements.txt

# 3. Config (optional — the app runs with no .env at all)
cp .env.example .env

# 4. Run
uvicorn app.main:app --reload
```

Then open **http://127.0.0.1:8000/docs**.

### No API keys needed

Every external integration has an offline fallback and the fallback is the default. The
whole demo path works with the wifi switched off. Keys upgrade the experience; their
absence never breaks it. See `.env.example` for what each key adds.

## Try it in 30 seconds

In `/docs`:
1. `POST /auth/register` — any username, email and an 8+ character password.
2. Click **Authorize** (top right), enter the same username and password.
3. `GET /auth/me` — you are signed in.

Or from a terminal:

```bash
curl -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"dominic","email":"dominic@example.com","password":"recycle123"}'
```

## Tests

```bash
venv/Scripts/python -m pytest tests/ -q
```

## Layout

```
app/
  main.py          app factory, CORS, error handlers
  config.py        every setting, all env-driven
  database.py      engine + session dependency
  core/            shared deps (identity), error types, logging
  models/          SQLModel tables
  schemas/         request/response models
  routers/         thin HTTP layer
  services/        business logic
  repositories/    non-trivial queries
  agents/          LangGraph (chatbot, verification) — isolated from the rest
  integrations/    external APIs, each behind an interface with a fallback
  utils/
tests/
planning/          architecture and implementation plan
```

Design notes and the rationale behind each choice are in
[`planning/00-architecture.md`](planning/00-architecture.md). Why there is no
authentication, and exactly how to add it back, is in
[`planning/02-auth-decision.md`](planning/02-auth-decision.md).

## Endpoints so far

| Method | Path | Purpose |
|---|---|---|
| POST | `/users` | Create a user. Only `username` is required |
| GET | `/users` | List users — handy for picking an id to act as |
| GET | `/users/{user_id}` | One user |
| GET | `/me` | Echo back whoever `user_id` / `X-User-Id` points at |
| GET | `/bins/nearby` | Bins near a point, nearest first. No API key needed |
| GET | `/bins/{bin_id}` | One bin |
| GET | `/recycle/{qr_code_id}` | Resolve a scanned QR sticker to its bin |
| POST | `/recycle/{qr_code_id}/submit` | Submit photo proof, earn points |
| GET | `/activities/{activity_id}` | One recycling activity |
| GET | `/users/{user_id}/activities` | A user's recycling history |
| POST | `/groups` | Create a group, creator joins automatically |
| POST | `/groups/join` | Join with an invite code |
| POST | `/groups/{group_id}/join` | Join by id |
| POST | `/groups/{group_id}/leave` | Leave |
| GET | `/groups/{group_id}` | Group with member count and totals |
| GET | `/groups/{group_id}/members` | Members and what each contributed |
| GET | `/groups/{group_id}/leaderboard` | Members ranked, ties share a rank |
| GET | `/groups/{group_id}/activities` | Activity feed with ready-made text |
| GET | `/users/{user_id}/groups` | A user's groups |
| POST | `/chat` | Ask a recycling question (LangGraph + RAG) |
| GET | `/health` | Liveness |

No endpoint requires authentication — there is a test asserting that stays true.

Worth trying:

```bash
# "Where can I recycle my old keyboard?" — e-waste within 5 km of NUS Central Library
curl "http://127.0.0.1:8000/bins/nearby?latitude=1.2966&longitude=103.7729&type=e_waste&radius=5000"

# Scanning the sticker on the NUS Engineering e-waste bin
curl "http://127.0.0.1:8000/recycle/sg-nus-eng-ew-01"
```

Bins, QR submission, groups, pet, chatbot, leaderboard and news follow — see
[`planning/01-implementation-plan.md`](planning/01-implementation-plan.md).

## The chatbot

`POST /chat` runs a **LangGraph** state machine, not a single model call:

```
classify -> retrieve -> generate -> ground check
   |                                     ^
   +--- out of scope --> redirect -------+
```

- **retrieve** is BM25 over a curated Singapore knowledge base, scored with a keyword
  bonus weighted by keyword rarity. Pure Python, no vector store, no embedding call.
- **generate** is the only node that touches the network. Claude when `ANTHROPIC_API_KEY`
  works, a verbatim quote of the best-matching knowledge chunk when it does not.
- **ground check** verifies the answer against what was retrieved and overrides claims the
  knowledge base does not support - if a model ever says batteries go in the blue bin,
  that answer does not ship.

The point of the graph is that the two nodes preventing invented disposal advice run
**identically with or without an API key**. Losing the key degrades the wording, never
the correctness. Responses carry `used_model` and `grounded` so the UI can show which
mode it is in.

When nothing matches, it says so rather than guessing:

```
Q: How do I dispose of radioactive waste from my reactor?
   grounded=false, sources=[]
   "I don't have reliable information on that one..."
```

A failed model call latches off for the rest of the process, so a bad key costs one
round trip rather than one per question (measured: 2058ms, then 5ms).

**The knowledge base is hand-written from public NEA guidance and should be verified
before judging.** It is not scraped from an authoritative feed.

## Groups

Points earned alone are a score; points earned for a group your friends can see are
social pressure, which is the half of the loop the brief actually cares about.

A group is joined by **invite code**, not by numeric id - `join with 7KPQ4M` works when
read aloud across a table. Codes drop confusable characters (`0`/`O`, `1`/`I`/`L`, `S`)
and ignore case and dashes on input.

The feed composes its own sentence, so every client renders it identically:

```
Dominic recycled e-waste 🔌 +20 points
Hari recycled ♻️ +10 points
```

Leaderboard ties **share a rank** - two members on 35 points are both third. Inventing
an order between equal scores would be arbitrary and visibly unfair.

Leaving a group does not rewrite its history: past activities and points stay attributed.

## Anti-abuse, and what it honestly is

Submissions are checked in this order, cheapest first, and nothing is written to disk
or the database until every check passes:

| Check | Behaviour |
|---|---|
| QR resolves to an active bin | 404 otherwise |
| Bin accepts that waste stream | 422, and the message says what it does accept |
| File type and size | 422, limits from `.env` |
| Per-bin cooldown | 429. Only **approved** submissions start it — a blurry photo must not lock you out of a bin you walked to |
| Daily cap | 429 |
| Duplicate photo | 409, via perceptual hash, so resizing or recompressing does not defeat it |
| Verification | Structural checks on the image; a rejection is recorded with 0 points, not an error |

**Verification is a game mechanic, not proof that anyone recycled.** The offline checker
confirms the upload is a real photograph rather than a blank screen, a solid colour or a
thumbnail. It cannot tell recycling from a sandwich. It raises the effort of cheating
above the effort of walking to a bin, which is all a points game needs — and that is how
it should be described to a judge.

## Data provenance

**The bin locations in `app/seeds/bins.py` are demo data, not an official registry.**
The venues are real, publicly known Singapore locations and the bin types are the kinds
those venues typically host, but the coordinates are approximate landmark positions and
the individual bins are invented. Nothing is scraped from, or endorsed by, NEA or ALBA.
The Ecovolt brief explicitly allows this: *"No real sensors, hardware, or live data. You
may invent or mock any inputs."*

Distances are computed locally with the haversine formula — no maps API, no key, works
offline.

## Acknowledgements

Third-party components are recorded here as they are introduced, per the competition rules.

- **FastAPI**, **Uvicorn**, **Starlette** — web framework (MIT)
- **SQLModel**, **SQLAlchemy** — ORM (MIT)
- **Pydantic**, **pydantic-settings** — validation and config (MIT)
- **Pillow** — image handling for proof-photo hashing (MIT-CMU)
- **httpx** — async HTTP client (BSD-3)
- **LangGraph**, **LangChain** — the chatbot state graph (MIT)
- **Anthropic Python SDK** / **langchain-anthropic** — Claude access (MIT)
- **qrcode** — printable bin stickers (BSD)
- **pytest** — tests (MIT)
