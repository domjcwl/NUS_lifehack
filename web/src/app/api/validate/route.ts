import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = HAS_KEY ? new Anthropic() : null;

/**
 * Offline fallback. Used only when no credential is configured, and the caller
 * is told so explicitly via `stubbed: true` — the UI surfaces it. A demo that
 * silently fakes its own validation step would be dishonest; one that dies
 * because the venue wifi dropped is just lost marks.
 */
function stub() {
  return {
    verified: true,
    item: "plastic bottle",
    stream: "plastic",
    correctlySorted: true,
    confidence: 0.0,
    reason: "Validator is stubbed — no API key configured on this machine.",
    stubbed: true,
  };
}

const SCHEMA = {
  type: "object",
  properties: {
    verified: {
      type: "boolean",
      description: "True only if the photo genuinely shows a recyclable item being placed in or held at a recycling bin.",
    },
    item: {
      type: "string",
      description: "Short name of the item, e.g. 'plastic bottle'. 'unclear' if it cannot be identified.",
    },
    stream: {
      type: "string",
      enum: ["plastic", "paper", "metal", "glass", "none"],
      description: "Which recycling stream the item belongs to, or 'none' if it is not recyclable.",
    },
    correctlySorted: {
      type: "boolean",
      description: "True if the item appears to be going into the right stream for its material.",
    },
    confidence: { type: "number", description: "0 to 1." },
    reason: { type: "string", description: "One short sentence the user will read. Warm, never preachy." },
  },
  required: ["verified", "item", "stream", "correctlySorted", "confidence", "reason"],
  additionalProperties: false,
} as const;

const SYSTEM = `You verify photos for a campus recycling habit app.

A photo passes only if it plausibly shows a real recyclable item at or entering a
recycling bin — held up to it, dropped in, or resting in the opening. It is
evidence of an action, not a product shot.

Reject: screenshots, photos of screens, stock images, an empty bin with no item,
general waste (food, tissues, styrofoam), or anything too dark or blurred to tell.

Be generous about framing and lighting — this is a phone photo taken in a corridor,
not a studio. Be strict about whether an action actually happened.

Write "reason" as one short sentence to the user. Warm and specific. Never lecture,
never moralise, never mention the environment or guilt. If you reject, say plainly
what was missing so they can retry.`;

export async function POST(req: Request) {
  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image) {
      return NextResponse.json({ error: "No image supplied." }, { status: 400 });
    }
    if (!client) return NextResponse.json(stub());

    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(image);
    if (!match) {
      return NextResponse.json({ error: "Unsupported image format." }, { status: 400 });
    }
    const [, mediaType, data] = match;

    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data } },
            { type: "text", text: "Verify this recycling action." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Could not process that image." }, { status: 422 });
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "Empty response from validator." }, { status: 502 });
    }

    return NextResponse.json({ ...JSON.parse(text.text), stubbed: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
