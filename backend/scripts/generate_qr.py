"""Generate printable QR stickers for the seeded bins.

    python scripts/generate_qr.py
    python scripts/generate_qr.py --base-url http://192.168.1.42:5173
    python scripts/generate_qr.py --only sg-nus-lib-01 sg-nus-eng-ew-01

Each sticker is a PNG with the QR code, the bin name, what it accepts and the code in
readable text underneath, so a human can type it if a camera will not cooperate. A
contact sheet with every sticker is written alongside them for printing in one go.

**Set --base-url to an address your phone can actually reach.** `localhost` in a QR
code resolves to the phone itself and will not work. On the same wifi, use the laptop's
LAN address; `ipconfig` on Windows will show it.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import qrcode  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from app.config import settings  # noqa: E402
from app.seeds.bins import BIN_SEEDS  # noqa: E402

STICKER_W, STICKER_H = 620, 750
QR_SIZE = 520
MARGIN = 50

WHITE, BLACK, GREY = (255, 255, 255), (17, 17, 17), (110, 110, 110)
GREEN, BLUE = (22, 128, 70), (28, 86, 168)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Best available system font, falling back to Pillow's bitmap default."""
    for name in (["arialbd.ttf", "seguisb.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    lines, current = [], ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _centre(draw: ImageDraw.ImageDraw, y: int, text: str, font, fill) -> int:
    width = draw.textlength(text, font=font)
    draw.text(((STICKER_W - width) / 2, y), text, font=font, fill=fill)
    return y + (font.size + 8)


def make_sticker(record: dict, base_url: str) -> Image.Image:
    url = f"{base_url.rstrip('/')}/recycle/{record['qr_code_id']}"

    # ERROR_CORRECT_H tolerates about 30% damage, which matters for a sticker that
    # will live on a bin in the Singapore weather.
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.Resampling.NEAREST)

    sticker = Image.new("RGB", (STICKER_W, STICKER_H), WHITE)
    draw = ImageDraw.Draw(sticker)

    is_ewaste = record["type"] == "e_waste"
    accent = GREEN if is_ewaste else BLUE
    heading = "E-WASTE" if is_ewaste else "RECYCLING"
    points = settings.POINTS_EWASTE if is_ewaste else settings.POINTS_RECYCLING

    draw.rectangle([0, 0, STICKER_W, 8], fill=accent)

    y = _centre(draw, 28, f"SCAN TO EARN {points} POINTS", _font(30, bold=True), accent)
    y = _centre(draw, y, heading, _font(20, bold=True), GREY)

    sticker.paste(qr_img, ((STICKER_W - QR_SIZE) // 2, y + 6))
    y = y + QR_SIZE + 26

    for line in _wrap(draw, record["name"], _font(24, bold=True), STICKER_W - 2 * MARGIN):
        y = _centre(draw, y, line, _font(24, bold=True), BLACK)

    y = _centre(draw, y + 4, record["qr_code_id"], _font(20), GREY)
    _centre(draw, y, settings.APP_NAME, _font(17), accent)

    return sticker


def make_contact_sheet(stickers: list[Image.Image], columns: int = 3) -> Image.Image:
    """All stickers on one canvas, so the whole set prints in a single job."""
    gap = 24
    rows = (len(stickers) + columns - 1) // columns
    thumb_w = STICKER_W // 2
    thumb_h = STICKER_H // 2

    sheet = Image.new(
        "RGB",
        (columns * thumb_w + (columns + 1) * gap, rows * thumb_h + (rows + 1) * gap),
        WHITE,
    )
    for index, sticker in enumerate(stickers):
        row, col = divmod(index, columns)
        thumb = sticker.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (gap + col * (thumb_w + gap), gap + row * (thumb_h + gap)))
    return sheet


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=settings.QR_BASE_URL,
        help="Front of the URL encoded in each QR. Must be reachable from a phone.",
    )
    parser.add_argument("--out", default="qr_codes", help="Output directory.")
    parser.add_argument(
        "--only", nargs="*", default=None, help="Limit to these qr_code_ids."
    )
    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="Also generate stickers for bins seeded as out of service.",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    records = BIN_SEEDS
    if args.only:
        wanted = set(args.only)
        records = [r for r in records if r["qr_code_id"] in wanted]
        missing = wanted - {r["qr_code_id"] for r in records}
        if missing:
            print(f"Unknown qr_code_id(s): {', '.join(sorted(missing))}")
            raise SystemExit(1)
    if not args.include_inactive:
        records = [r for r in records if r.get("active", True)]

    if "localhost" in args.base_url or "127.0.0.1" in args.base_url:
        print("WARNING: a phone scanning this QR will resolve localhost to itself.")
        print("         Pass --base-url http://<your-laptop-lan-ip>:5173 before printing.")
        print()

    stickers = []
    for record in records:
        sticker = make_sticker(record, args.base_url)
        stickers.append(sticker)
        sticker.save(out_dir / f"{record['qr_code_id']}.png")

    if stickers:
        make_contact_sheet(stickers).save(out_dir / "_contact_sheet.png")

    print(f"Wrote {len(stickers)} stickers to {out_dir}/")
    print(f"Contact sheet: {out_dir}/_contact_sheet.png")
    print(f"Encoded URLs look like: {args.base_url.rstrip('/')}/recycle/{records[0]['qr_code_id']}")


if __name__ == "__main__":
    main()
