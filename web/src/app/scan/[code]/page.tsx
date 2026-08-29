import Link from "next/link";
import type { Metadata } from "next";
import { binByCode } from "@/lib/bins";
import ScanClient from "./ScanClient";

/**
 * What a printed QR opens.
 *
 * The bin is resolved here, on the server, and handed down. The alternative —
 * looking it up in the client — would ship all 12,902 bins to a phone to render
 * one address.
 */
export default async function Scan({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bin = binByCode(code);

  /* A sticker that has been peeled, rained on, or stuck to the wrong bin. The
     person is standing at a bin holding rubbish, so this says what to do next
     rather than just reporting a 404. */
  if (!bin) {
    return (
      <div className="stagger space-y-4">
        <div>
          <Link href="/" className="press mono inline-block text-label text-[var(--frost-dim)]">
            Back to Nanuq
          </Link>
          <h1 className="mt-2 text-head">That code is not one of ours</h1>
          <p className="mt-1 text-body text-[var(--frost-dim)]">
            The sticker may be damaged, or from an older print run. You can still find this
            bin on the map and log it from there.
          </p>
          <p className="mono mt-3 text-label text-[var(--frost-faint)]">Scanned: {code}</p>
        </div>
        <Link
          href="/bins"
          className="press btn-primary flex min-h-14 w-full items-center justify-center rounded-full px-6 text-body font-medium"
        >
          Open the bin map
        </Link>
      </div>
    );
  }

  return <ScanClient bin={bin} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const bin = binByCode(code);
  return { title: bin ? `${bin.name} · Floe` : "Unknown bin · Floe" };
}
