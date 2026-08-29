import { NextResponse } from "next/server";
import { binByCode } from "@/lib/bins";
import { qrSvg, scanUrlFor } from "@/lib/qr";

/**
 * The QR for one bin, as SVG.
 *
 * Rendered on demand rather than pre-generated as 12,902 files: the code is a
 * pure function of the bin's location, so the image is too, and there is
 * nothing worth storing. SVG because these get printed at whatever size the
 * paper allows.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const bin = binByCode(code);
  if (!bin) {
    return NextResponse.json({ error: "No bin has that code." }, { status: 404 });
  }

  const svg = await qrSvg(scanUrlFor(req, bin.code));

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      /* Deterministic output, so it can be cached hard. */
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
