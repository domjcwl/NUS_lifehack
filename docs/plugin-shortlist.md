# Plugin shortlist

Nothing is installed yet — deliberately. Installing everything up front bloats context for no
benefit. At ~11:05, once the brief is chosen, install **only** what it needs.

Install: `claude plugin install <name>@claude-plugins-official`
Then restart the session for the plugin to load.

## Already installed
`context7` (live library docs — use it instead of guessing API syntax), `frontend-design`,
`superpowers`, `slack`.

`@playwright/mcp` is installed globally and registered as an MCP server — this is our browser
automation path for testing the running app and capturing demo screenshots. The Claude-in-Chrome
extension is **not** connected.

## By brief

### Sustainability / IoT / smart buildings (Ecovolt — our expected direction)
| Plugin | When |
|---|---|
| `grafana-mcp` | Only if the brief genuinely needs dashboards/alerting infrastructure. Usually overkill for 24h — a chart library is faster. |
| `supabase` | Postgres + auth + realtime, if we need multi-user or live-updating sensor data. |
| `duckdb-skills` | If the brief hands us a large dataset to analyse. Fast, no server. |

For most sustainability builds, **no new plugin is needed** — `context7` plus a charting library
covers it. Do not install out of habit.

### If we end up on another brief
| Brief | Plugin |
|---|---|
| Visa — payments / agentic commerce | `stripe` (Visa itself has no plugin; Stripe is the closest usable sandbox) |
| ViSenze — AI search / product discovery | `huggingface-skills`, `pinecone` (vector search) |
| CSIT — cybersecurity / secure systems | `claude-security`, `auth0` |
| Enterprise engineering | depends entirely on the brief |

### Generally useful, any brief
| Plugin | When |
|---|---|
| `chrome-devtools-mcp` | Debugging the live app — console, network, performance. Overlaps with Playwright MCP; only add if Playwright is not enough. |
| `supabase` / `convex` / `firebase` / `neon` | "We need a backend right now." Pick one, not several. |
| `vercel`-adjacent / `cloudflare` | Only if we decide to deploy. Local-only is a valid choice. |

## Rule

**One plugin per actual need.** If you cannot name the specific task it unblocks in the next two
hours, do not install it. Time spent installing and restarting is time not spent building, and
context spent on unused tools is context not spent on our code.
