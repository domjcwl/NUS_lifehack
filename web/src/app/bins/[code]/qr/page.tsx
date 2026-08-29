import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { binByCode } from "@/lib/bins";
import { originFrom, qrSvg } from "@/lib/qr";

/**
 * The sticker that goes on the bin.
 *
 * Deliberately printable: everything below is laid out for a sheet of paper,
 * and the print rules strip the app's chrome and dark ground so it does not
 * come out of the printer as a black rectangle.
 */
export default async function BinQr({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bin = binByCode(code);
  if (!bin) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const url = `${originFrom(host, h.get("x-forwarded-proto"))}/scan/${bin.code}`;
  const svg = await qrSvg(url);

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="screen-only">
        <Link href="/bins" className="press mono inline-block text-label text-[var(--frost-dim)]">
          Back to the map
        </Link>
        <h1 className="mt-2 text-head">Sticker for this bin</h1>
        <p className="mt-1 text-body text-[var(--frost-dim)]">
          Print it and stick it on the bin. Scanning it opens this bin&rsquo;s page, so the
          photo is logged against the right block.
        </p>
      </div>

      {/* The sheet. White ground and black ink even on screen, because what is
          on screen here is a preview of a printed thing. */}
      <div className="sticker">
        <p className="sticker-kicker">{bin.kind === "ewaste" ? "E-WASTE" : "RECYCLING"}</p>
        <h2 className="sticker-name">{bin.name}</h2>
        <p className="sticker-postal">Singapore {bin.postal}</p>

        <div className="sticker-qr" dangerouslySetInnerHTML={{ __html: svg }} />

        <p className="sticker-do">Bin it, photograph it, scan this.</p>
        <p className="sticker-code">{bin.code}</p>
      </div>

      <div className="screen-only mt-5 space-y-3">
        <button className="press btn-primary min-h-14 w-full rounded-full px-6 text-body font-medium print-btn">
          Print this sticker
        </button>
        <p className="text-meta text-[var(--frost-dim)]">
          Opens: <span className="mono break-all text-label">{url}</span>
        </p>
        <Link
          href={`/scan/${bin.code}`}
          className="press hoverable inline-flex min-h-14 items-center rounded-full border border-[var(--edge)] px-6 text-body"
        >
          Open it without scanning
        </Link>
      </div>

      {/* The button needs a click handler and this page is a server component;
          a form action would be a round trip for something the browser does
          locally. This is the smallest honest way to do it. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('.print-btn')?.addEventListener('click',()=>window.print())`,
        }}
      />
    </>
  );
}

const PRINT_CSS = `
.sticker {
  background: #fff;
  color: #000;
  border-radius: 1rem;
  padding: 1.5rem;
  margin-top: 1.25rem;
  text-align: center;
}
.sticker-kicker {
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  color: #444;
}
.sticker-name {
  font-size: 1.5rem;
  line-height: 1.15;
  font-weight: 700;
  margin-top: 0.35rem;
  color: #000;
}
.sticker-postal { font-size: 0.875rem; color: #444; margin-top: 0.2rem; }
.sticker-qr { margin: 1rem auto 0; width: min(78%, 320px); }
.sticker-qr svg { width: 100%; height: auto; display: block; }
.sticker-do { font-size: 1rem; font-weight: 600; margin-top: 0.9rem; color: #000; }
.sticker-code {
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 0.875rem;
  letter-spacing: 0.22em;
  color: #444;
  margin-top: 0.3rem;
}

/*
 * Printing. The app is a dark theme on a fixed dark ground with floating
 * chrome — sent to a printer unchanged that is a page of black ink with a tab
 * bar across it.
 */
@media print {
  .screen-only, nav, .aurora, .underglow { display: none !important; }
  :root, html, body { background: #fff !important; }
  body { color: #000 !important; }
  main, body > div { padding: 0 !important; max-width: none !important; }
  .sticker {
    margin: 0;
    border: 2px solid #000;
    border-radius: 12px;
    page-break-inside: avoid;
  }
  .sticker-qr { width: 70mm; }
}
`;
