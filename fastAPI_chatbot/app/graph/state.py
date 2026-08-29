"""The state carried through the graph.

One TypedDict, `total=False`, so every node returns only the keys it owns and
LangGraph merges them. Nothing here is persisted: the frontend sends the full
conversation on each request, so the service stays stateless and needs no
checkpointer, no session store and therefore no database.
"""

from typing import Literal, TypedDict

from app.rag.knowledge import Chunk
from app.tools.bins import BinKind, NearbyBin
from app.tools.geocode import Place

Intent = Literal["disposal", "ewaste", "location", "background", "out_of_scope"]


class Message(TypedDict):
    role: Literal["user", "assistant"]
    content: str


class ChatState(TypedDict, total=False):
    # --- input ---------------------------------------------------------------
    messages: list[Message]
    question: str
    latitude: float | None
    longitude: float | None

    # --- contextualize -------------------------------------------------------
    # The question rewritten to stand on its own. "What about the charger?" becomes
    # "how do I dispose of a laptop charger?" so retrieval has something to match.
    query: str
    # Offline only. With no model to rewrite the follow-up, this holds the
    # previous turn joined to this one, and `retrieve` uses it ONLY when the
    # question retrieves nothing on its own.
    fallback_query: str

    # --- classify ------------------------------------------------------------
    intent: Intent
    needs_kb: bool
    needs_bins: bool
    bin_kind: BinKind | None
    # A place the user named ("raffles hall", "521826"), pulled out by regex
    # before any network call. None when they did not say where they are.
    place_query: str | None

    # --- gather --------------------------------------------------------------
    chunks: list[tuple[Chunk, float]]
    bins: list[NearbyBin]
    # True when the user asked where something is, shared no coordinates AND
    # named no place we could resolve - so the answer has to ask.
    needs_location: bool
    # Set when coordinates came from a place name rather than the device. The
    # answer names it, so a misparse is visible to the user instead of silently
    # sending them to the wrong neighbourhood.
    resolved_place: Place | None

    # --- generate / ground_check --------------------------------------------
    answer: str
    grounded: bool
    used_model: bool
    notes: list[str]
