"""Verifier selection."""

from functools import lru_cache

from app.agents.verification.base import VerificationResult, Verifier
from app.agents.verification.heuristic import HeuristicVerifier
from app.core.logging import get_logger

logger = get_logger(__name__)

__all__ = ["VerificationResult", "Verifier", "HeuristicVerifier", "get_verifier"]


@lru_cache
def get_verifier() -> Verifier:
    """The configured verifier.

    Only the offline heuristic exists today. Step 9 adds a vision-model backend that
    is used when OPENAI_API_KEY is set, falling back to this one when it is not or
    when the API call fails - the demo must never depend on a network call.
    """
    return HeuristicVerifier()
