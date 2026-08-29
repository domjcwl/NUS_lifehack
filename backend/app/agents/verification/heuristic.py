"""Offline verification, no API key required.

What it actually checks: that the upload is a real, readable photograph rather than a
blank screen, a solid colour or a thumbnail. It cannot tell recycling from a photo of a
sandwich - only the vision backend attempts that, and even then imperfectly.

Being precise about this matters. Overstating it in the pitch invites a judge to
disprove it in ten seconds.
"""

from io import BytesIO

from PIL import Image, ImageStat, UnidentifiedImageError

from app.agents.verification.base import VerificationResult
from app.core.logging import get_logger
from app.models.enums import MediaType, VerificationStatus

logger = get_logger(__name__)

# A photo much smaller than this is a thumbnail or an icon, not a camera capture.
_MIN_DIMENSION = 200
# Standard deviation of brightness. A real photo has plenty of variation; a solid
# colour or blank screenshot has almost none.
_MIN_STDDEV = 8.0


class HeuristicVerifier:
    """Structural checks on the uploaded media."""

    def verify(
        self, data: bytes, media_type: MediaType, waste_type: str
    ) -> VerificationResult:
        if media_type == MediaType.VIDEO:
            # Decoding video needs ffmpeg, which is not a dependency worth adding here.
            return VerificationResult(
                status=VerificationStatus.APPROVED,
                score=0.6,
                note="Video accepted without image analysis.",
            )

        try:
            with Image.open(BytesIO(data)) as img:
                img.load()
                width, height = img.size
                greyscale = img.convert("L")
                stddev = ImageStat.Stat(greyscale).stddev[0]
        except (UnidentifiedImageError, OSError, ValueError):
            logger.info("Verification rejected: unreadable image")
            return VerificationResult(
                status=VerificationStatus.REJECTED,
                score=0.0,
                note="That file could not be read as an image. Try taking the photo again.",
            )

        if min(width, height) < _MIN_DIMENSION:
            logger.info("Verification rejected: %dx%d too small", width, height)
            return VerificationResult(
                status=VerificationStatus.REJECTED,
                score=0.1,
                note=(
                    f"That image is only {width}x{height}. Please upload the photo "
                    "straight from your camera rather than a thumbnail."
                ),
            )

        if stddev < _MIN_STDDEV:
            logger.info("Verification rejected: near-uniform image (stddev=%.1f)", stddev)
            return VerificationResult(
                status=VerificationStatus.REJECTED,
                score=0.1,
                note="That image looks blank. Take a photo of your item at the bin.",
            )

        # Scale the score with detail, capped: this checker can never be certain.
        score = min(0.5 + (stddev / 100.0), 0.85)
        return VerificationResult(
            status=VerificationStatus.APPROVED,
            score=round(score, 2),
            note="Photo accepted. Thanks for recycling!",
        )
