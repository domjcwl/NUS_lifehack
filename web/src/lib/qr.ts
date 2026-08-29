import QRCode from "qrcode";

/**
 * One bin's QR, as an SVG string.
 *
 * Error correction is Q (~25% recoverable). The default M is fine for a screen
 * and not for a sticker that lives on a bin lid outdoors, where it will be
 * rained on, scuffed and partly peeled before anyone points a camera at it.
 *
 * Always black on white. The app is a dark theme and it is tempting to match
 * it, but a low-contrast or inverted QR is one that fails in a dim lift lobby —
 * which is exactly where it will be used.
 */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/**
 * Whether a host is something we are reaching directly rather than through a
 * proxy that terminates TLS.
 *
 * Any bare IPv4 counts. Enumerating private ranges by prefix is how this went
 * wrong the first time: 192.168 and 10. were listed, and the machine handed out
 * 172.31.38.250 — inside 172.16/12, private, and missed. A phone then got a QR
 * pointing at https on a dev server that speaks only http, which fails at the
 * camera with nothing on screen to explain why.
 */
function isDirectHost(host: string): boolean {
  const name = host.split(":")[0];
  return (
    name === "localhost" ||
    name.endsWith(".local") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(name)
  );
}

/** The scheme and host to build absolute URLs from, given what a request saw. */
export function originFrom(host: string, forwardedProto: string | null): string {
  return `${forwardedProto ?? (isDirectHost(host) ? "http" : "https")}://${host}`;
}

/**
 * Absolute URL for a bin's scan page, derived from the incoming request.
 *
 * A QR is read by a camera app that has no notion of the site it came from, so
 * the URL has to be absolute. Taking it from the request rather than a
 * build-time constant means one code works on localhost, on a phone hitting the
 * dev server across the LAN, and in production — and the sticker you print is
 * always one that resolves from wherever you printed it.
 */
export function scanUrlFor(req: Request, code: string): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  return `${originFrom(host, h.get("x-forwarded-proto"))}/scan/${code}`;
}
