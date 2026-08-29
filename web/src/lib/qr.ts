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
 * Absolute URL for a bin's scan page, derived from the incoming request.
 *
 * A QR is read by a camera app that has no notion of the site it came from, so
 * the URL has to be absolute. Taking it from the request rather than a
 * build-time constant means the same code works on localhost, on a phone
 * hitting the dev server across the LAN, and in production.
 */
export function scanUrlFor(req: Request, code: string): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto =
    h.get("x-forwarded-proto") ?? (/^(localhost|127\.|192\.168\.|10\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}/scan/${code}`;
}
