import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * Photo verification. Uses OpenAI to match the Python backend, so one
 * OPENAI_API_KEY serves the whole project and the team is not maintaining two
 * model providers. Model names mirror backend/app/config.py deliberately.
 */

const HAS_KEY = Boolean(process.env.OPENAI_API_KEY);
const client = HAS_KEY ? new OpenAI() : null;
const MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";

const SCHEMA = {
  type: "object",
  properties: {
    verified: {
      type: "boolean",
      description:
        "True only if the photo genuinely shows a recyclable item being placed in or held at a recycling bin.",
    },
    item: {
      type: "string",
      description: "Short name of the item, e.g. 'plastic bottle'. 'unclear' if unidentifiable.",
    },
    stream: {
      type: "string",
      enum: ["plastic", "paper", "metal", "glass", "none"],
      description: "Which recycling stream the item belongs to, or 'none' if not recyclable.",
    },
    correctlySorted: {
      type: "boolean",
      description: "True if the item appears to be going into the right stream for its material.",
    },
    confidence: { type: "number", description: "0 to 1." },
    reason: {
      type: "string",
      description: "One short sentence the user will read. Warm, never preachy.",
    },
  },
  required: ["verified", "item", "stream", "correctlySorted", "confidence", "reason"],
  additionalProperties: false,
} as const;

const SYSTEM = `You verify photos for a recycling habit app used by HDB residents in Singapore.

A photo passes only if it plausibly shows a real recyclable item at or entering a
recycling bin — held up to it, dropped in, or resting in the opening. It is
evidence of an action, not a product shot.

Reject: screenshots, photos of screens, stock images, an empty bin with no item,
general waste (food, tissues, styrofoam), or anything too dark or blurred to tell.

Be generous about framing and lighting — this is a phone photo taken at a lift
lobby, not a studio. Be strict about whether an action actually happened.

Write "reason" as one short sentence to the user. Warm and specific. Never lecture,
never moralise, never mention the environment or guilt. If you reject, say plainly
what was missing so they can retry.`;

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
    confidence: 0,
    reason: "Validator is stubbed — no API key configured on this machine.",
    stubbed: true,
  };
}

/**
 * Identifies the exact photo, so the same one cannot be logged twice. It is a
 * content hash, not a perceptual one: a re-crop defeats it. Enough to stop the
 * lazy path of re-submitting one saved image, not a serious anti-fraud measure,
 * and the README says so.
 */
function hashOf(dataUrl: string): string {
  return createHash("sha256").update(dataUrl).digest("hex").slice(0, 32);
}

export async function POST(req: Request) {
  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image) {
      return NextResponse.json({ error: "No image supplied." }, { status: 400 });
    }
    if (!client) return NextResponse.json({ ...stub(), mediaHash: hashOf(image) });

    if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(image)) {
      return NextResponse.json({ error: "Unsupported image format." }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Verify this recycling action." },
            /* A data: URL is accepted directly, so the photo never needs storing. */
            { type: "image_url", image_url: { url: image, detail: "low" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "recycling_verdict", schema: SCHEMA, strict: true },
      },
      max_completion_tokens: 300,
    });

    const choice = completion.choices[0];
    if (choice?.finish_reason === "content_filter") {
      return NextResponse.json({ error: "Could not process that image." }, { status: 422 });
    }

    const text = choice?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "Empty response from validator." }, { status: 502 });
    }

    return NextResponse.json({ ...JSON.parse(text), stubbed: false, mediaHash: hashOf(image) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
