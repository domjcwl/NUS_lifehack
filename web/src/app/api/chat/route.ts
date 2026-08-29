/**
 * The chat endpoint the app talks to.
 *
 * This is a proxy, not an implementation. Answers come from the Python service
 * in `fastAPI_chatbot/`, which retrieves from a curated NEA knowledge base,
 * finds real collection points and ground-checks what it wrote. See
 * `src/lib/chatbot.ts` for why the logic lives there and not here.
 *
 * The fallback below is the exception that proves it. If that service is not
 * running — which at a judging table is one forgotten terminal away — a single
 * ungrounded model call answers instead, so the tab still works. It returns the
 * same shape with `grounded: false` and a note saying what happened, because a
 * degraded answer that looks identical to a good one is worse than no answer.
 */

import { NextResponse } from "next/server";
import { answerAt, answerNearest, placeFrom } from "@/lib/places";
import OpenAI from "openai";

import {
  ask,
  ChatbotUnavailable,
  type ChatMessage,
  type ChatReply,
  type Coords,
} from "@/lib/chatbot";

const HAS_KEY = Boolean(process.env.OPENAI_API_KEY);
const client = HAS_KEY ? new OpenAI() : null;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const SYSTEM = `You answer quick recycling questions for residents standing at a blue bin in Singapore.

Answer the actual question in one or two sentences. Lead with the verdict — which bin,
or that it is not recyclable — then the reason if it is not obvious.

Singapore specifics that matter: the blue commingled bins at the foot of most HDB blocks
take plastic, paper, metal and glass together. Food-contaminated items (greasy pizza boxes,
used tissues, unwashed containers) go in general waste and contaminate a whole bag if they
don't. Soft plastics and styrofoam are not accepted in most blue bins. Rinse containers
first.

Never lecture, never moralise, never add an environmental appeal. The person is standing at
a bin holding something and wants to know where it goes. If you genuinely do not know,
say so and suggest general waste rather than guessing — a wrong recyclable is worse than
a right general-waste item.`;

export async function POST(req: Request) {
  const { messages, location } = (await req.json()) as {
    messages?: ChatMessage[];
    location?: Coords | null;
  };
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages." }, { status: 400 });
  }

  let reply: ChatReply;
  try {
    reply = await ask(messages, location);
  } catch (err) {
    if (!(err instanceof ChatbotUnavailable)) throw err;
    console.warn(`[chat] falling back — knowledge service unavailable: ${err.message}`);
    reply = await degraded(messages);
  }

  /*
   * "Where is the nearest bin to X" is answerable here and nowhere else: this
   * process holds all 12,902 bins, and the knowledge service ships a gazetteer
   * of exactly one place, so it answers everything else with "use the map".
   * Telling someone holding a bottle to go look at a map is not an answer when
   * the real one is a name and a distance.
   *
   * Applied whether or not the service is up, and only when it has not already
   * resolved somewhere itself.
   */
  const asked = messages[messages.length - 1]?.content ?? "";
  const wantsPlace = reply.intent === "location" || reply.needs_location;
  if (wantsPlace) {
    /* The service resolves some places itself but answers in prose that never
       names a bin. Whoever resolved the spot, the reply is rebuilt from this
       app's own 12,902-bin dataset so the answer is a name and a distance. */
    const known = reply.resolved_location;
    const found = known
      ? answerAt({ name: known.name, lat: known.latitude, lng: known.longitude })
      : await (async () => {
          const place = placeFrom(asked);
          return place ? answerNearest(place) : null;
        })();
    {
      if (found) {
        reply = {
          ...reply,
          answer: found.answer,
          intent: "location",
          needs_location: false,
          resolved_location: found.resolved,
          locations: found.locations as ChatReply["locations"],
          notes: [...(reply.notes ?? []), "Bins from the NEA dataset in this app."],
        };
      }
    }
  }

  return NextResponse.json(reply);
}

/**
 * One model call, no retrieval, no bins. Everything the full service adds is
 * absent, and the reply says so rather than passing itself off as grounded.
 */
async function degraded(messages: ChatMessage[]): Promise<ChatReply> {
  const base: ChatReply = {
    answer: "",
    intent: "unknown",
    sources: [],
    locations: [],
    resolved_location: null,
    needs_location: false,
    grounded: false,
    used_model: false,
    notes: ["The knowledge service is not running — answered without NEA sources."],
  };

  if (!client) {
    return {
      ...base,
      answer:
        "The knowledge service is not running and no API key is configured, so I " +
        "cannot answer right now. Start it with `uvicorn app.main:app` in fastAPI_chatbot/.",
      notes: ["Knowledge service down and no OPENAI_API_KEY set."],
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      /* Short answers by construction — the person is standing at a bin. */
      max_completion_tokens: 200,
    });
    const choice = completion.choices[0];
    return {
      ...base,
      used_model: true,
      answer:
        choice?.finish_reason === "content_filter"
          ? "I can't answer that one."
          : (choice?.message?.content ?? "No answer came back."),
    };
  } catch (err) {
    return {
      ...base,
      answer: "I could not reach the assistant. Try again in a moment.",
      notes: [err instanceof Error ? err.message : "Chat failed."],
    };
  }
}
