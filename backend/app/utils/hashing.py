"""Media fingerprinting, for spotting re-uploaded proof photos.

Two kinds of fingerprint, both 16 hex characters so they share one database column:

* images -> **dHash**, a perceptual hash. Survives resizing, recompression and small
  edits, so someone cannot dodge it by screenshotting their own photo.
* video  -> truncated SHA-256 of the bytes. Exact matches only; analysing video frames
  is not worth the time for an MVP.

dHash works by shrinking the image to 9x8 greyscale and recording, for each row,
whether each pixel is brighter than the one to its right. That is 64 comparisons, so
64 bits. Similar images differ in only a few of those bits.
"""

import hashlib
from io import BytesIO

from PIL import Image, UnidentifiedImageError

_HASH_SIDE = 8


def dhash_image(data: bytes) -> str | None:
    """Perceptual hash of an image, or None if the bytes are not a readable image."""
    try:
        with Image.open(BytesIO(data)) as img:
            small = img.convert("L").resize(
                (_HASH_SIDE + 1, _HASH_SIDE), Image.Resampling.LANCZOS
            )
            # get_flattened_data() is the Pillow 12+ name; getdata() is the older
            # one and is deprecated for removal in Pillow 14. Support both.
            read_pixels = getattr(small, "get_flattened_data", small.getdata)
            pixels = list(read_pixels())
    except (UnidentifiedImageError, OSError, ValueError):
        return None

    bits = 0
    for row in range(_HASH_SIDE):
        offset = row * (_HASH_SIDE + 1)
        for col in range(_HASH_SIDE):
            left = pixels[offset + col]
            right = pixels[offset + col + 1]
            bits = (bits << 1) | int(left > right)
    return f"{bits:016x}"


def sha256_short(data: bytes) -> str:
    """First 64 bits of SHA-256, hex. Exact-duplicate detection for video."""
    return hashlib.sha256(data).hexdigest()[:16]


def hamming_distance(a: str, b: str) -> int:
    """Number of differing bits between two 16-hex-character hashes.

    Returns 64 (maximum distance) if either value is unparseable, so a bad hash can
    never be mistaken for a match.
    """
    try:
        return bin(int(a, 16) ^ int(b, 16)).count("1")
    except (TypeError, ValueError):
        return 64
