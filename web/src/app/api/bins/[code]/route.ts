import { NextResponse } from "next/server";
import { binByCode } from "@/lib/bins";

/**
 * One bin in full.
 *
 * The map payload carries only what draws a dot, so the name, postal code and
 * accepted streams are fetched here — once, for the single bin someone taps,
 * instead of for the twelve hundred they merely panned past.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const bin = binByCode(code);
  if (!bin) {
    return NextResponse.json({ error: "No bin has that code." }, { status: 404 });
  }
  return NextResponse.json({ bin });
}
