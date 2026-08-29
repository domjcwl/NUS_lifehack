/**
 * Client for the Python chatbot service in `fastAPI_chatbot/`.
 *
 * That service owns every answer the app gives about what goes in which bin: it
 * runs BM25 retrieval over a curated NEA knowledge base, geocodes a place the
 * user names, searches the same 13,004-point dataset this app maps, and checks
 * the finished answer against what it retrieved. None of that belongs in a Next
 * route handler, and duplicating a thinner version of it here is exactly the
 * two-implementations failure this repo has corrected once already.
 *
 * The types below mirror `app/schemas.py`. They are hand-written rather than
 * generated from the OpenAPI document because the shape is small and a build
 * step that needs the Python service running is a build step that breaks at 3am.
 */

/** Where the service lives. Same-machine default; set CHATBOT_URL to move it. */
export const CHATBOT_URL = process.env.CHATBOT_URL ?? "http://127.0.0.1:8000";

/**
 * The service does retrieval, a model call and a ground check in sequence, which
 * measured at ~3s with a key configured. 25s is generous enough to survive a
 * slow model and short enough that the UI is never left hanging at a demo.
 */
const TIMEOUT_MS = 25_000;

export type Source = {
  id: string;
  topic: string;
  title: string;
  url: string;
  /** True when `snippet` is verbatim from `url`. False means it is our summary —
   *  it must not be presented to the user as an NEA quotation. */
  quoted: boolean;
  snippet: string;
};

export type BinLocation = {
  name: string;
  kind: "recycling" | "ewaste";
  postal: string;
  streams: string[];
  latitude: number;
  longitude: number;
  metres: number;
  directions_url: string;
};

export type ResolvedLocation = {
  name: string;
  latitude: number;
  longitude: number;
  source: string;
};

export type ChatReply = {
  answer: string;
  intent: string;
  sources: Source[];
  locations: BinLocation[];
  resolved_location: ResolvedLocation | null;
  /** The user asked "where" without sharing coordinates or naming a place we
   *  could resolve. Offer geolocation and send the message again. */
  needs_location: boolean;
  /** False when nothing supported the answer — show it with less confidence. */
  grounded: boolean;
  used_model: boolean;
  notes: string[];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Coords = { latitude: number; longitude: number };

/** Thrown when the service is unreachable, times out, or returns non-2xx. */
export class ChatbotUnavailable extends Error {}

export async function ask(
  messages: ChatMessage[],
  location?: Coords | null,
): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch(`${CHATBOT_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, location: location ?? null }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    /* Connection refused, DNS, or the timeout above — all mean the same thing
       to the caller: the service is not answering right now. */
    throw new ChatbotUnavailable(err instanceof Error ? err.message : "unreachable");
  }
  if (!res.ok) {
    throw new ChatbotUnavailable(`chatbot responded ${res.status}`);
  }
  return (await res.json()) as ChatReply;
}

/** Whether the service is up, and what it has loaded. Used by /api/chat/health. */
export async function health() {
  const res = await fetch(`${CHATBOT_URL}/health`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new ChatbotUnavailable(`health responded ${res.status}`);
  return (await res.json()) as {
    status: string;
    chunks: number;
    bins: number;
    places_cached: number;
    model_configured: boolean;
  };
}
