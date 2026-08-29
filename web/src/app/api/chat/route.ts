import { NextResponse } from "next/server";
import OpenAI from "openai";

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
  const { messages } = (await req.json()) as {
    messages?: { role: "user" | "assistant"; content: string }[];
  };
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages." }, { status: 400 });
  }
  if (!client) {
    return NextResponse.json({
      reply: "Chat is stubbed — no API key configured on this machine.",
      stubbed: true,
    });
  }

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      /* Short answers by construction — the person is standing at a bin. */
      max_completion_tokens: 200,
    });

    const choice = completion.choices[0];
    if (choice?.finish_reason === "content_filter") {
      return NextResponse.json({ reply: "I can't answer that one.", stubbed: false });
    }

    return NextResponse.json({
      reply: choice?.message?.content ?? "No answer came back.",
      stubbed: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
