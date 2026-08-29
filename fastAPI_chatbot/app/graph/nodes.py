"""The graph's nodes.

Every node except `contextualize` and `generate` is deterministic Python and runs
identically with or without an API key. That is the whole safety argument: losing
the key costs fluency, never correctness. A model never decides whether a battery
goes in the blue bin — retrieval does, and `ground_check` audits the result.
"""

import logging
from typing import Any

from app.config import settings
from app.graph import places
from app.graph.state import ChatState
from app.rag import retrieval, store
from app.rag.knowledge import Chunk
from app.tools import bins as bin_tool
from app.tools import geocode

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# The OpenAI client, and the latch that stops a bad key costing a round trip per
# request. A demo cannot afford a network timeout on every question because
# someone typo'd a key.
# ---------------------------------------------------------------------------

_MODEL_BROKEN = False


def _client():
    """The OpenAI client, or None when no usable credential is configured."""
    if _MODEL_BROKEN or not settings.openai_enabled:
        return None
    try:
        from openai import OpenAI

        return OpenAI(
            api_key=settings.OPENAI_API_KEY, timeout=settings.CHAT_TIMEOUT_SECONDS
        )
    except Exception:
        logger.exception("Could not construct the OpenAI client; answering offline")
        return None


def _break_model(exc: Exception) -> None:
    global _MODEL_BROKEN
    _MODEL_BROKEN = True
    logger.warning(
        "Model call failed (%s); answering from the knowledge base for the rest of "
        "this process",
        type(exc).__name__,
    )


def reset_model_state() -> None:
    """Clear the broken-model latch. For tests, and after fixing a key."""
    global _MODEL_BROKEN
    _MODEL_BROKEN = False


# ---------------------------------------------------------------------------
# node 1: contextualize
# ---------------------------------------------------------------------------

# Openers and bare pronouns that mean the message cannot be understood alone.
# "What about the charger?" retrieves nothing useful; "how do I dispose of a
# laptop charger?" retrieves the right chunk.
_FOLLOW_UP_OPENERS = ("what about", "how about", "and the", "and what", "what if", "ok what")
_BARE_PRONOUNS = (" it", " it?", "it ", "them", "those", "these", "that one", "this one")


def _looks_like_follow_up(question: str) -> bool:
    q = question.lower().strip()
    if q.startswith(_FOLLOW_UP_OPENERS):
        return True
    # Short and pronoun-led: "is it recyclable?", "where do I put them?"
    return len(q) < 60 and any(p in f" {q} " for p in _BARE_PRONOUNS)


def _previous_user_message(state: ChatState) -> str:
    """The user turn before this one, if any."""
    history = state.get("messages", [])
    earlier = [m for m in history[:-1] if m.get("role") == "user"]
    return earlier[-1]["content"] if earlier else ""


def contextualize(state: ChatState) -> dict[str, Any]:
    """Rewrite a follow-up into a question that stands on its own.

    Skipped entirely when the message reads as self-contained, so the common case
    pays nothing. With no model, the previous turn is offered to `retrieve` as a
    fallback rather than searched directly — see the comment below for why joining
    the two questions outright gives the wrong answer.
    """
    question = state["question"]
    if not _looks_like_follow_up(question):
        return {"query": question}

    previous = _previous_user_message(state)
    if not previous:
        return {"query": question}

    client = _client()
    if client is None:
        # Offer the joined text as a fallback rather than searching with it. Joining
        # lets the PREVIOUS question's terms outscore this one - ask "what about the
        # charger?" after a laptop question and BM25 returns the laptop chunk. So
        # `retrieve` tries the bare question first and only falls back when it
        # genuinely matches nothing.
        return {"query": question, "fallback_query": f"{previous} {question}"}

    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Rewrite the follow-up as one standalone question about waste "
                        "disposal in Singapore, resolving what the pronoun refers to "
                        "from the previous question. Reply with the question only, no "
                        "preamble. If it is already standalone, repeat it unchanged."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Previous question: {previous}\nFollow-up: {question}",
                },
            ],
            max_completion_tokens=60,
        )
        rewritten = (response.choices[0].message.content or "").strip()
        if not rewritten:
            raise ValueError("empty rewrite")
        logger.info("Contextualized %r -> %r", question, rewritten)
        return {"query": rewritten}
    except Exception as exc:
        _break_model(exc)
        return {"query": question, "fallback_query": f"{previous} {question}"}


# ---------------------------------------------------------------------------
# node 2: classify
# ---------------------------------------------------------------------------

# Keyword routing, not a model call. Classification only decides WHAT CONTEXT TO
# GATHER — `generate` sees everything gathered either way — so a misroute degrades
# an answer rather than breaking it. That tolerance is what makes a free
# classifier the right trade here.

_SCOPE_HINTS = (
    "recycl", "waste", "bin", "dispose", "disposal", "e-waste", "ewaste", "battery",
    "batteries", "plastic", "paper", "glass", "metal", "can", "tin", "carton",
    "styrofoam", "polystyrene", "compost", "landfill", "incinerat", "semakau", "nea",
    "rubbish", "trash", "garbage", "sustain", "electronic", "laptop", "phone", "bulb",
    "lamp", "cardboard", "contaminat", "environment", "climate", "throw", "chuck",
    "cable", "charger", "keyboard", "monitor", "printer", "tv", "television", "fridge",
    "aircon", "appliance", "clothes", "clothing", "textile", "food", "pizza", "bottle",
    "container", "bag", "collection point", "donate", "mattress", "furniture",
)

# Strong enough to justify interrupting the user for their location.
_LOCATION_HINTS = (
    "nearest", "nearby", "near me", "near by", "closest", "collection point",
    "drop off", "drop-off", "dropoff", "directions", "navigate", "how do i get to",
    "around me", "close to me", "where can i find", "find me a", "near ",
)

_EWASTE_HINTS = (
    "e-waste", "ewaste", "electronic", "electrical", "laptop", "computer", "pc",
    "macbook", "notebook", "phone", "handphone", "mobile", "smartphone", "tablet",
    "ipad", "battery", "batteries", "power bank", "charger", "cable", "wire",
    "keyboard", "mouse", "monitor", "screen", "printer", "tv", "television",
    "bulb", "lamp", "fluorescent", "fridge", "refrigerator", "washing machine",
    "aircon", "air conditioner", "kettle", "hair dryer", "appliance", "gadget",
    "device", "router", "console", "camera", "headphone", "earphone",
)

_RECYCLING_HINTS = (
    "blue bin", "recycling bin", "recycle bin", "plastic", "paper", "cardboard",
    "glass", "metal", "tin", "carton", "bottle", "newspaper",
)

_DISPOSAL_HINTS = (
    "can i", "do i", "should i", "how do i", "is it", "recycl", "dispose", "throw",
    "chuck", "bin", "put",
)

# Verbs that mean "I am holding this and want it gone", as opposed to asking a
# factual question about it. Someone who says where they are AND wants to get rid
# of something has asked a location question without using a location word:
# "I'm at Raffles Hall and I want to dispose some old cables" needs a collection
# point, and answering it with "check the NEA website" is a non-answer.
#
# Deliberately narrower than _DISPOSAL_HINTS. This list only ever ADDS a bin
# lookup, and only when we already know where the user is, so the cost of a false
# positive is a correct answer with a nearby bin appended - not a wrong answer.
_DISPOSE_INTENT = (
    "dispose", "disposal", "get rid of", "throw away", "throw out",
    "chuck", "drop off", "drop-off", "dropoff", "recycle", "return", "hand in",
    "bring", "take it", "take them", "take my", "throw",
)


def _place_in_conversation(state: ChatState) -> str | None:
    """The most recent place the user named, this turn or earlier.

    Someone who says "I stay at Raffles Hall" in their first message should not
    have to repeat it to ask "where can I drop it off?" two turns later. The
    current turn wins, then the offline fallback text, then history newest
    first - so moving to a new place immediately overrides the old one.
    """
    if place := places.extract_place(state.get("question", "")):
        return place
    if fallback := state.get("fallback_query"):
        if place := places.extract_place(fallback):
            return place
    history = state.get("messages", [])
    for message in reversed(history[:-1]):
        if message.get("role") != "user":
            continue
        if place := places.extract_place(message.get("content", "")):
            return place
    return None


def classify(state: ChatState) -> dict[str, Any]:
    # Hints are matched over the follow-up joined to its context, so "where can I
    # drop it off?" after a laptop question still routes to e-waste bins. Retrieval
    # is stricter about which text it searches; routing can afford to be generous.
    q = " ".join(
        filter(None, [state.get("query", state["question"]), state.get("fallback_query", "")])
    ).lower()
    has_coords = state.get("latitude") is not None

    if not any(hint in q for hint in _SCOPE_HINTS):
        return {"intent": "out_of_scope", "needs_kb": False, "needs_bins": False}

    asked_where = any(hint in q for hint in _LOCATION_HINTS)
    is_ewaste = any(hint in q for hint in _EWASTE_HINTS)

    # Did they tell us where they are? "I stay at Raffles Hall", "521826".
    # Searched across the whole conversation, so a follow-up like "where can I
    # drop it off?" inherits the place named in an earlier turn.
    place_query = _place_in_conversation(state)

    # Both of the softer triggers below only count when we can actually answer
    # them: either coordinates are in hand, or they named somewhere we can look up.
    can_locate = has_coords or place_query is not None

    # A bare "where" is too weak to interrupt the user for coordinates, but it is
    # a fine trigger once we already have them.
    weak_where = "where" in q
    # Stating a place and wanting rid of something is a location question with the
    # location word left out. This is the path that makes "I am at Raffles Hall and
    # I want to dispose some old cables" resolve Raffles Hall and return bins.
    wants_to_dispose = any(hint in q for hint in _DISPOSE_INTENT)

    needs_bins = asked_where or (can_locate and (weak_where or wants_to_dispose))

    if asked_where:
        intent = "location"
    elif is_ewaste:
        intent = "ewaste"
    elif any(hint in q for hint in _DISPOSAL_HINTS):
        intent = "disposal"
    else:
        intent = "background"

    # Which bins to look up. Unknown means search both, which is right for a vague
    # "where can I recycle this" that never named the item.
    if is_ewaste:
        bin_kind = "ewaste"
    elif any(hint in q for hint in _RECYCLING_HINTS):
        bin_kind = "recycling"
    else:
        bin_kind = None

    return {
        "intent": intent,
        "needs_kb": True,
        "needs_bins": needs_bins,
        "bin_kind": bin_kind,
        "place_query": place_query,
    }


def route_after_classify(state: ChatState) -> str:
    return "refuse" if state["intent"] == "out_of_scope" else "retrieve"


# ---------------------------------------------------------------------------
# nodes 3 and 4: gather
# ---------------------------------------------------------------------------
# Both may run for one question. That is the point: "where do I throw my old
# phone?" is simultaneously an e-waste question and a location one, and a router
# that picks a single branch answers half of it.


def retrieve(state: ChatState) -> dict[str, Any]:
    chunks = retrieval.search(state.get("query", state["question"]), limit=3)
    if not chunks and (fallback := state.get("fallback_query")):
        # The follow-up matched nothing alone ("is it recyclable?"), so fall back to
        # the joined text and let the previous turn supply the missing noun.
        chunks = retrieval.search(fallback, limit=3)
    logger.info(
        "Retrieval: intent=%s hits=%s",
        state.get("intent"),
        [c.id for c, _ in chunks] or "none",
    )
    return {"chunks": chunks}


def resolve_location(state: ChatState) -> dict[str, Any]:
    """Turn a named place into coordinates, when the device supplied none.

    Runs only when the question actually needs bins, so an ordinary disposal
    question never touches the network. Coordinates from the device always
    win: if the phone shared a position, a place name in the text is ignored.
    """
    if not state.get("needs_bins"):
        return {}
    if state.get("latitude") is not None:
        return {"resolved_place": None}

    query = state.get("place_query")
    if not query:
        return {}

    place = geocode.geocode(query)
    if place is None:
        logger.info("Could not resolve %r to a location", query)
        return {}

    return {
        "latitude": place.latitude,
        "longitude": place.longitude,
        "resolved_place": place,
    }


def find_bins(state: ChatState) -> dict[str, Any]:
    if not state.get("needs_bins"):
        return {"bins": [], "needs_location": False}

    lat, lng = state.get("latitude"), state.get("longitude")
    if lat is None or lng is None:
        # Asked where, but we have no coordinates. Say so rather than inventing a
        # location or silently answering a different question.
        return {"bins": [], "needs_location": True}

    found = bin_tool.find_bins(
        lat, lng, state.get("bin_kind"), limit=settings.NEAREST_LIMIT
    )
    logger.info("Bin lookup: kind=%s hits=%d", state.get("bin_kind"), len(found))
    return {"bins": found, "needs_location": False}


# ---------------------------------------------------------------------------
# node 5: generate
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You answer recycling and e-waste questions for people in \
Singapore, usually standing at a bin holding something and wanting to know where \
it goes.

Answer in one or two sentences. Lead with the verdict - which bin, or that it is \
not recyclable - then the reason only if it is not obvious.

You must use ONLY the reference material provided in the user message. It is the \
authoritative source. If the reference material does not answer the question, say \
you are not sure and suggest general waste or checking the NEA website. Never \
invent a disposal instruction: a confidently wrong answer sends a battery into a \
recycling truck.

If nearby collection points are listed, name the closest one and its distance \
exactly as given. Never invent a place name, an address or a distance.

If the reference material says a location is needed but none was given, ask the \
user for their postal code or to share their location. Ask once, briefly.

Never lecture, never moralise, never add an environmental appeal. The person did \
not ask to be educated, they asked where to put something."""

NO_KNOWLEDGE = (
    "I don't have reliable information on that one. When you are not sure, general "
    "waste is safer than guessing - a wrong item in the blue bin can contaminate a "
    "whole bag. The NEA website has the full guidance."
)

ASK_FOR_LOCATION = (
    "I can find the nearest one - share your location, or tell me your postal code."
)


def _bins_block(state: ChatState) -> str:
    """The bin list as reference material, or a note that a location is needed."""
    if state.get("needs_location"):
        return "Nearby collection points: NONE - the user has not shared a location."

    found = state.get("bins", [])
    if not found:
        return ""

    header = ""
    if resolved := state.get("resolved_place"):
        # Say which place was assumed. If the parser grabbed the wrong phrase
        # the user sees it immediately rather than walking to the wrong estate.
        header = f"The user's location was taken to be {resolved.name}.\n"

    lines = [
        f"{i}. {n.bin.name} ({n.bin.kind}, postal {n.bin.postal}) - {n.metres} m away"
        for i, n in enumerate(found, 1)
    ]
    return (
        header
        + "Nearby collection points (already looked up, use these exactly):\n"
        + "\n".join(lines)
    )


def _extractive_answer(state: ChatState) -> str:
    """The offline answer: retrieved knowledge quoted rather than paraphrased.

    Less fluent than a generated reply, and completely incapable of being wrong
    about anything the knowledge base gets right. For disposal advice that is the
    correct trade.

    Only the best chunk is quoted. Concatenating the runners-up reads as rambling
    and buries the verdict.
    """
    chunks: list[tuple[Chunk, float]] = state.get("chunks", [])
    parts: list[str] = [chunks[0][0].text if chunks else NO_KNOWLEDGE]

    if state.get("needs_location"):
        parts.append(ASK_FOR_LOCATION)
    elif found := state.get("bins", []):
        nearest = found[0]
        where = ""
        if resolved := state.get("resolved_place"):
            where = f" to {resolved.name}"
        parts.append(
            f"Nearest{where}: {nearest.bin.name}, about {nearest.metres} m away."
        )

    return " ".join(parts)


def generate(state: ChatState) -> dict[str, Any]:
    client = _client()
    if client is None:
        return {
            "answer": _extractive_answer(state),
            "used_model": False,
            "notes": ["No language model configured - answered from the knowledge base."],
        }

    reference = "\n\n".join(
        f"[{chunk.id}] {chunk.text}" for chunk, _ in state.get("chunks", [])
    ) or "(no reference material matched this question)"

    if block := _bins_block(state):
        reference = f"{reference}\n\n{block}"

    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Reference material:\n{reference}\n\n"
                        f"Question: {state.get('query', state['question'])}"
                    ),
                },
            ],
            max_completion_tokens=settings.CHAT_MAX_TOKENS,
        )
        choice = response.choices[0]
        if choice.finish_reason == "content_filter":
            raise ValueError("content filtered")
        text = (choice.message.content or "").strip()
        if not text:
            raise ValueError("empty response")
        return {"answer": text, "used_model": True, "notes": []}
    except Exception as exc:
        # A model failure must never take the endpoint down.
        _break_model(exc)
        return {
            "answer": _extractive_answer(state),
            "used_model": False,
            "notes": ["The language model was unavailable - answered from the knowledge base."],
        }


# ---------------------------------------------------------------------------
# node 6: ground check
# ---------------------------------------------------------------------------

# Claims that must never appear unless the knowledge base actually supports them.
_RISKY_CLAIMS = (
    ("battery", "blue bin"),
    ("batteries", "blue bin"),
    ("styrofoam", "recyclable"),
)


def ground_check(state: ChatState) -> dict[str, Any]:
    """Verify the answer is anchored in retrieved material.

    Cheap and deterministic: it does not judge wording, only whether there was any
    supporting evidence and whether the answer contradicts the knowledge base on
    the handful of claims that are actively dangerous to get wrong. A model
    checking a model can hallucinate the check; this cannot.
    """
    chunks = state.get("chunks", [])
    notes = list(state.get("notes", []))

    if not chunks:
        # Bins alone are still a real, sourced answer to "where is the nearest bin".
        if state.get("bins"):
            return {"grounded": True, "notes": notes}
        notes.append("No supporting knowledge was found, so this answer is not sourced.")
        return {"grounded": False, "notes": notes}

    lowered = state.get("answer", "").lower()
    supporting = " ".join(chunk.text.lower() for chunk, _ in chunks)
    for subject, claim in _RISKY_CLAIMS:
        if subject in lowered and claim in lowered and claim not in supporting:
            logger.warning("Answer contradicted the knowledge base on %r", subject)
            notes.append(f"Answer overridden: unsupported claim about {subject}.")
            return {
                "answer": _extractive_answer(state),
                "grounded": True,
                "used_model": False,
                "notes": notes,
            }

    return {"grounded": True, "notes": notes}


# ---------------------------------------------------------------------------
# node 7: refuse
# ---------------------------------------------------------------------------


def refuse(state: ChatState) -> dict[str, Any]:
    return {
        "answer": (
            "I only cover recycling and waste disposal in Singapore. Ask me what goes "
            "in the blue bin, where to take e-waste, or what happens to your recycling."
        ),
        "chunks": [],
        "bins": [],
        "needs_location": False,
        "grounded": True,
        "used_model": False,
        "notes": ["Question was outside the assistant's scope."],
    }


__all__ = [
    "classify",
    "contextualize",
    "find_bins",
    "generate",
    "ground_check",
    "refuse",
    "resolve_location",
    "reset_model_state",
    "retrieve",
    "route_after_classify",
    "store",
]
