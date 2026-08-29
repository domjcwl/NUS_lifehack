# Floe chatbot service

The recycling and e-waste assistant for [Floe](../README.md), as a FastAPI service
with a LangGraph state machine behind it. Answers questions like *"can I recycle a
pizza box?"*, *"where do I throw my old phone?"* and *"what about the charger?"*
for Singapore, grounded in NEA guidance, and returns the nearest real collection
point with a directions link.

**You do not have to share your location.** Either the phone supplies
coordinates, or you just say where you are — *"I stay at Raffles Hall"*,
*"near NUS"*, *"521826"* — and the service resolves it. Postal codes and street
names resolve offline from the bin dataset itself; landmarks go to
OpenStreetMap, and every result is cached to disk so it keeps working after.

**It works with no API key.** Retrieval, routing, the bin finder and the ground
check are deterministic Python. Without `OPENAI_API_KEY` the service answers from
its knowledge base verbatim and reports `used_model: false` — less fluent, still
correct, still sourced, still finds the bin.

This service owns the chatbot and nothing else. Identity, the bin map, photo
verification, points, groups and the impact model live in [`web/`](../web) — see
the Sat 15:30 entry in [`docs/decisions.md`](../docs/decisions.md).

## Run it

```bash
cd fastAPI_chatbot
python -m pip install -r requirements.txt
cp .env.example .env          # optional — it runs without one
python -m uvicorn app.main:app --reload --port 8000
```

Interactive docs at <http://127.0.0.1:8000/docs>. Check it came up correctly:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","chunks":58,"bins":13004,"places_cached":6,"model_configured":false}
```

If `bins` is 0, `BINS_PATH` is wrong — it defaults to `../web/data/bins.json`.

```bash
python -m pytest tests/ -q     # 55 tests, ~0.5s, no network, no key
```

## Try it

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Where can I throw away my old phone?"}],
       "location":{"latitude":1.3489,"longitude":103.9412}}'
```

```jsonc
{
  "answer": "Mobile phones and tablets are e-waste. Drop them at an e-waste collection
             point... Nearest: Our Tampines Hub, about 371 m away.",
  "intent": "ewaste",
  "sources": [{ "id": "ewaste-phone", "title": "NEA - E-waste management",
                "url": "https://www.nea.gov.sg/...", "quoted": false, "snippet": "..." }],
  "locations": [{ "name": "Our Tampines Hub", "kind": "ewaste", "metres": 371,
                  "directions_url": "https://www.google.com/maps/dir/?api=1&..." }],
  "needs_location": false,
  "grounded": true,
  "used_model": false,
  "notes": ["No language model configured - answered from the knowledge base."]
}
```

Fields worth knowing before you build UI on this:

| Field | Meaning |
|---|---|
| `grounded` | **Check this before presenting an answer confidently.** False means nothing in the knowledge base supported it. |
| `used_model` | False means the offline path answered. |
| `quoted` | True only when the snippet is NEA's own words. False means it is our summary — do not render it as an NEA quotation. |
| `needs_location` | The user asked *where* but shared no coordinates. Prompt for geolocation and resend. |

## How it works

```
contextualize → classify → retrieve → resolve_location → find_bins → generate → ground_check
                    │
                    └── out of scope → refuse
```

- **contextualize** — turns *"what about the charger?"* into a standalone question.
  Skipped when the message already stands alone, so most turns pay nothing.
- **classify** — keyword heuristics, not a model call. Decides *what context to
  gather*, and `generate` sees everything gathered, so a misroute degrades an
  answer rather than breaking it.
- **retrieve** — BM25 over the knowledge base, with a score floor. A question the
  corpus does not cover retrieves **nothing**, which is what lets the assistant
  say it does not know instead of guessing.
- **resolve_location** — turns a place the user named into coordinates, but only
  when the question needs bins and the device gave none. Device coordinates
  always win over text. The answer names the place it assumed, so a misparse is
  visible rather than silently sending someone to the wrong estate.
- **find_bins** — haversine over 13,004 real NEA points. Runs alongside retrieval,
  not instead of it: *"where do I throw my old phone?"* is an e-waste question
  **and** a location question, and answering only one half is wrong.
- **generate** — one model call, or the extractive answer when there is no key.
- **ground_check** — deterministic. Flags unsourced answers, and overrides the
  handful of claims that are dangerous to get wrong (*"batteries go in the blue
  bin"*) when the sources do not support them.

Why a graph and not one model call: the nodes that stop this thing inventing
disposal instructions are separate, inspectable steps that run identically with or
without a key. Losing the key costs fluency, never correctness.

### Knowledge base

Two tiers, searched together:

- **Curated** (26 chunks, `app/rag/knowledge.py`) — hand-written from public NEA
  guidance. Each reads sensibly quoted verbatim, which is what the offline path
  does with it. Cited with the NEA page on the topic, `quoted: false`.
- **Ingested** (32 chunks, `data/chunks.json`) — text extracted from real NEA
  pages by `scripts/ingest.py`. Cited with the page it came from, `quoted: true`.

Curated chunks win ties, so everyday questions get the tuned answer and the
ingested tier covers what the curated tier does not (the EPR scheme, mercury
limits, MRF processes).

To refresh the ingested tier — **run this with wifi and commit the output**, never
at demo time:

```bash
python scripts/ingest.py     # rewrites data/chunks.json and data/sources.json
```

There is no vector database. At ~58 single-topic chunks, BM25 with a keyword prior
retrieves as well as embeddings, needs no API key, and its score floor is what
makes "I don't know" possible — cosine similarity always returns a nearest
neighbour however irrelevant. `retrieval.search()` is one function; swap its body
for embeddings if the corpus ever reaches the thousands.

## Wiring to the app

`web/src/app/api/chat/route.ts` proxies to this service and maps `answer` → `reply`,
so the existing chat page keeps working unchanged. Set in `web/.env`:

```
CHAT_BACKEND_URL=http://127.0.0.1:8000
```

If this service is down or that variable is unset, `/api/chat` falls back to
calling the model directly — no retrieval and no bin lookup, but the demo does not
break. The response carries `degraded: true` on that path.

Both processes need to be running for the full experience:

```bash
python -m uvicorn app.main:app --port 8000     # in fastAPI_chatbot/
npm run dev                                    # in web/
```

The chat page uses the full response: it sends `location` when the browser has
granted it, renders `locations[]` as cards with a directions link, shows the
source row, and offers a **Use my location** button when the backend reports
`needs_location`. It asks for geolocation only when a question actually needs
it, rather than burning the one-shot permission prompt on page load.

## Configuration

Everything is optional; the defaults run with no `.env` at all.

| Variable | Default | Notes |
|---|---|---|
| `OPENAI_API_KEY` | *(none)* | Absent, the service answers from the knowledge base. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Matches `web/.env.example`. |
| `BINS_PATH` | `../web/data/bins.json` | Shared with `web/`, never copied. |
| `CHUNKS_PATH` | `data/chunks.json` | Ingested NEA chunks. |
| `PLACES_PATH` | `data/places.json` | Resolved place names, cached and committed. |
| `GEOCODE_ENABLED` | `true` | Set false to stay entirely offline. |
| `GEOCODE_TIMEOUT_SECONDS` | `6` | Short on purpose — better to ask than to stall. |
| `ONEMAP_TOKEN` | *(none)* | Optional. Better SG coverage, but tokens expire. |
| `CORS_ORIGINS` | `*` | Comma-separated, or `*`. |
| `CHAT_MAX_TOKENS` | `250` | Answers are one or two sentences by design. |

## Acknowledgements

- **NEA (National Environment Agency, Singapore)** — recycling and e-waste
  guidance. The pages ingested, with fetch dates, are recorded in
  [`data/sources.json`](data/sources.json).
- **data.gov.sg / NEA** — recycling bin and e-waste collection point datasets,
  fetched by `scripts/fetch-bins.py` at the repo root.
- **OpenStreetMap contributors, via Nominatim** — place-name geocoding, used
  under the ODbL. Cached to `data/places.json` to stay inside their usage policy.
- **FastAPI**, **LangGraph**, **Pydantic**, **OpenAI Python SDK**, **pypdf**.
