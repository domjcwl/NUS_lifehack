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

  try {
    return NextResponse.json(await ask(messages, location));
  } catch (err) {
    if (!(err instanceof ChatbotUnavailable)) throw err;
    console.warn(`[chat] falling back — knowledge service unavailable: ${err.message}`);
    return NextResponse.json(await degraded(messages));
  }
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
