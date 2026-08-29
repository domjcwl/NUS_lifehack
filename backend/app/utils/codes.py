"""Human-typable invite codes.

A group is joined by typing a short code, not by pasting a numeric id. That matters
for the demo - "join with code 7KPQ4M" works when read aloud across a table, and it is
the mechanic that gets a second person into the group in the first place.
"""

import secrets

# Confusable characters are dropped so a code survives being read aloud or written on
# a whiteboard. Removing one side of each pair is enough to kill the ambiguity:
#   0 and O  -> both dropped
#   1, I, L  -> all dropped
#   S        -> dropped, so 5 is unambiguous
_ALPHABET = "23456789ABCDEFGHJKMNPQRTUVWXYZ"
_CONFUSABLE_PAIRS = [("0", "O"), ("1", "I"), ("1", "L"), ("I", "L"), ("5", "S")]
_LENGTH = 6


def generate_invite_code(length: int = _LENGTH) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def normalise_invite_code(code: str) -> str:
    """Accept what a human typed: any case, with stray spaces or dashes."""
    return code.strip().upper().replace(" ", "").replace("-", "")
