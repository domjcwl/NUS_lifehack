import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = HAS_KEY ? new Anthropic() : null;

const SYSTEM = `You answer quick recycling questions for students on the NUS campus in Singapore.

Answer the actual question in one or two sentences. Lead with the verdict — which bin,
or that it is not recyclable — then the reason if it is not obvious.

Singapore specifics that matter: blue commingled bins take plastic, paper, metal and glass
together. Food-contaminated items (greasy pizza boxes, used tissues, unwashed containers)
go in general waste and contaminate a whole bag if they don't. Soft plastics and styrofoam
are not accepted in most blue bins. Rinse containers first.

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
    const res = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 512,
      system: SYSTEM,
      output_config: { effort: "low" },
      messages,
    });
    if (res.stop_reason === "refusal") {
      return NextResponse.json({ reply: "I can't answer that one.", stubbed: false });
    }
    const text = res.content.find((b) => b.type === "text");
    return NextResponse.json({
      reply: text?.type === "text" ? text.text : "No answer came back.",
      stubbed: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
