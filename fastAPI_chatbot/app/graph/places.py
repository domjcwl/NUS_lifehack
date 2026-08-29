"""Pulling a place out of a question, before any network call is made.

Pure regex, no model, no lookup. `classify` runs this so that "I stay at Raffles
Hall, where can I throw my old laptop" is recognised as a location question at all
— which it otherwise is not, because "where" alone is too weak a signal to justify
interrupting the user for coordinates.

The hard part is not finding places, it is NOT finding them. "Can I put it in the
blue bin" contains "in <noun phrase>" and must never be geocoded: sending someone
to a bin 8 km away because the parser matched "the blue bin" is worse than asking
them for a postal code. So the preposition patterns are split by strength, and
every candidate is filtered against the vocabulary of the domain.
"""

import re

# A Singapore postal code. Unambiguous, so it needs no surrounding phrasing.
POSTAL_RE = re.compile(r"\b(\d{6})\b")

# Where the captured phrase must stop. Without these the match runs on into the
# rest of the sentence and geocodes "raffles hall singapore where can i throw".
_STOP = (
    r"(?=\s*(?:[,.?!]|$|\b(?:where|how|what|which|can|could|should|do|does|is|are|"
    r"i|my|the\s+nearest|and|but|so)\b))"
)

# "I stay at X", "I live in X", "I'm at X" — the speaker stating where they are.
# Unambiguous enough to accept whatever follows.
_STRONG = re.compile(
    r"\bi(?:'m|m)?\s+(?:stay|live|reside|am|work|study)?\s*(?:at|in|near|around)\s+"
    r"(?P<place>[a-z0-9][\w '&/.-]{2,60}?)" + _STOP,
    re.I,
)

# "near X", "around X", "beside X" — proximity words that no waste question uses
# about a bin's contents.
_PROXIMITY = re.compile(
    r"\b(?:near|nearby|around|beside|next\s+to|close\s+to|opposite|outside)\s+"
    r"(?P<place>[a-z0-9][\w '&/.-]{2,60}?)" + _STOP,
    re.I,
)

# Bare "at X" / "in X". Genuinely ambiguous, so anything matching the domain
# vocabulary below is discarded.
_WEAK = re.compile(
    r"\b(?:at|in)\s+(?P<place>[a-z0-9][\w '&/.-]{2,60}?)" + _STOP,
    re.I,
)

# If a candidate contains any of these it is describing waste or furniture, not a
# location worth geocoding.
_NOT_A_PLACE = (
    "bin", "bag", "waste", "trash", "rubbish", "garbage", "recycl", "chute",
    "container", "box", "bottle", "can", "carton", "tray", "packaging", "wrapper",
    "general", "blue", "landfill", "incinerat", "truck", "compost", "drawer",
    "cupboard", "kitchen", "house", "home", "room", "office",
    # Household fixtures. "rinse the container in the sink" is not a location.
    "sink", "tap", "basin", "drain", "toilet", "bathroom", "washing machine",
    "the morning", "the evening", "advance", "fact", "future", "case", "order",
)

# Leading filler that survives the capture: "at the Raffles Hall" -> "Raffles Hall".
_LEADING = re.compile(r"^(?:the|a|an|my|our)\s+", re.I)

# "Raffles Hall Singapore" is a place; "Singapore" alone is a country, and
# geocoding it drops a pin nobody is standing at. Strip the qualifier and judge
# what is left — which is why this is stripped here rather than blocked outright.
_QUALIFIER = re.compile(r"\b(?:singapore|s'?pore|sg)\b", re.I)

_MULTISPACE = re.compile(r"\s{2,}")


def _clean(candidate: str) -> str:
    candidate = _QUALIFIER.sub(" ", candidate)
    candidate = _LEADING.sub("", candidate.strip(" ,.?!'\"")).strip()
    return _MULTISPACE.sub(" ", candidate).strip(" ,.?!-")


def _plausible(candidate: str) -> bool:
    if len(candidate) < 3:
        return False
    lowered = candidate.lower()
    if any(word in lowered for word in _NOT_A_PLACE):
        return False
    # A place has letters. "at 3" or "in 2 days" is not one.
    return bool(re.search(r"[a-z]{3}", lowered))


def extract_place(question: str) -> str | None:
    """The place the user says they are at, or None.

    A postal code wins outright. Otherwise the strongest matching pattern wins, so
    an explicit "I stay at ..." beats an incidental "in ...".
    """
    if postal := POSTAL_RE.search(question):
        return postal.group(1)

    for pattern in (_STRONG, _PROXIMITY, _WEAK):
        for match in pattern.finditer(question):
            candidate = _clean(match.group("place"))
            if _plausible(candidate):
                return candidate
    return None
