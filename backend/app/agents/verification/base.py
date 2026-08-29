"""Verification interface.

**This is a game mechanic, not proof that someone recycled.** It raises the effort of
submitting nonsense above the effort of actually walking to the bin, which is all a
points game needs. Nobody should describe it to a judge as fraud detection.

`VerificationResult` is what every backend returns, so swapping the heuristic checker
for a vision model changes one factory function.
"""

from dataclasses import dataclass
from typing import Protocol

from app.models.enums import MediaType, VerificationStatus


@dataclass(frozen=True)
class VerificationResult:
    status: VerificationStatus
    score: float  # 0.0 - 1.0, how confident the checker is
    note: str  # shown to the user, so write it in plain language


class Verifier(Protocol):
    def verify(
        self, data: bytes, media_type: MediaType, waste_type: str
    ) -> VerificationResult: ...
