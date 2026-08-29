"""The recycling chatbot, as a LangGraph state machine.

    question
       |
    classify          which kind of question is this
       |
       +--- out of scope ---> redirect ----+
       |                                   |
    retrieve          BM25 over the knowledge base
       |                                   |
    generate          Claude if configured, extractive answer if not
       |                                   |
    ground_check      is every claim backed by a retrieved chunk
       |                                   |
       +-----------------------------------+---> answer

Why a graph rather than one call: the two nodes that stop this thing inventing disposal
instructions - `retrieve` and `ground_check` - are separate, inspectable steps that run
identically whether or not a model is involved. `generate` is the only node that needs
an API key, so losing the key degrades the wording, never the correctness.
"""

from typing import Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.chatbot import retrieval
from app.agents.chatbot.knowledge import Chunk
from app.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

Category = Literal["disposal", "location", "background", "out_of_scope"]


class ChatState(TypedDict, total=False):
    question: str
    category: Category
    chunks: list[tuple[Chunk, float]]
    answer: str
    sources: list[str]
    grounded: bool
    used_model: bool
    notes: list[str]


# --- node 1: classify -------------------------------------------------------

_LOCATION_HINTS = ("where", "nearest", "near me", "drop off", "collection point", "find")
_DISPOSAL_HINTS = ("can i", "do i", "should i", "how do i", "recycle", "dispose", "throw", "bin")
_SCOPE_HINTS = (
    "recycl", "waste", "bin", "dispose", "e-waste", "ewaste", "battery", "batteries",
    "plastic", "paper", "glass", "metal", "can", "carton", "styrofoam", "compost",
    "landfill", "incinerat", "semakau", "nea", "rubbish", "trash", "garbage", "sustain",
    "electronic", "laptop", "phone", "bulb", "lamp", "cardboard",
    "contaminat", "environment", "climate",
)


def classify(state: ChatState) -> dict[str, Any]:
    question = state["question"].lower()

    if not any(hint in question for hint in _SCOPE_HINTS):
        return {"category": "out_of_scope"}
    if any(hint in question for hint in _LOCATION_HINTS):
        return {"category": "location"}
    if any(hint in question for hint in _DISPOSAL_HINTS):
        return {"category": "disposal"}
    return {"category": "background"}


def route_after_classify(state: ChatState) -> Literal["retrieve", "redirect"]:
    return "redirect" if state["category"] == "out_of_scope" else "retrieve"


# --- node 2: retrieve -------------------------------------------------------


def retrieve(state: ChatState) -> dict[str, Any]:
    chunks = retrieval.search(state["question"], limit=3)
    logger.info(
        "Chat retrieval: category=%s hits=%s",
        state["category"],
        [c.id for c, _ in chunks] or "none",
    )
    return {"chunks": chunks, "sources": [chunk.id for chunk, _ in chunks]}


# --- node 3: generate -------------------------------------------------------

SYSTEM_PROMPT = """You answer recycling questions for people in Singapore, usually \
standing at a bin holding something and wanting to know where it goes.

Answer in one or two sentences. Lead with the verdict - which bin, or that it is not \
recyclable - then the reason only if it is not obvious.

You must use ONLY the reference material provided in the user message. It is the \
authoritative source. If the reference material does not answer the question, say you \
are not sure and suggest general waste or checking the NEA website. Never invent a \
disposal instruction: a confidently wrong answer sends a battery into a recycling truck.

Never lecture, never moralise, never add an environmental appeal. The person did not ask \
to be educated, they asked where to put something."""


def _extractive_answer(chunks: list[tuple[Chunk, float]]) -> str:
    """The offline answer: the retrieved knowledge, quoted rather than paraphrased.

    Less fluent than a generated reply, and completely incapable of being wrong about
    anything the knowledge base gets right. That trade is the correct one for disposal
    advice.

    Only the best chunk is quoted. Concatenating the runners-up reads as rambling and
    buries the verdict - the answer to "where does my keyboard go" should not continue
    into a paragraph about Semakau landfill.
    """
    if not chunks:
        return (
            "I don't have reliable information on that one. When you are not sure, "
            "general waste is safer than guessing - a wrong item in the blue bin can "
            "contaminate a whole bag. The NEA website has the full guidance."
        )
    return chunks[0][0].text


# Set once the model has failed, so a bad or missing key costs one round trip per
# process rather than one per request. A demo cannot afford a network timeout on every
# question because someone typo'd the key.
_MODEL_BROKEN = False


def _build_llm():
    """The chat model, or None when no usable credential is configured."""
    if not settings.anthropic_enabled:
        return None
    try:
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=settings.CHAT_MAX_TOKENS,
            timeout=settings.CHAT_TIMEOUT_SECONDS,
            api_key=settings.ANTHROPIC_API_KEY,
        )
    except Exception:
        logger.exception("Could not construct the chat model; using the offline answer")
        return None


def generate(state: ChatState) -> dict[str, Any]:
    global _MODEL_BROKEN

    chunks = state.get("chunks", [])
    # The latch is checked here rather than inside _build_llm so it holds however the
    # model is constructed.
    llm = None if _MODEL_BROKEN else _build_llm()

    if llm is None:
        return {
            "answer": _extractive_answer(chunks),
            "used_model": False,
            "notes": ["No language model configured - answered from the knowledge base."],
        }

    reference = "\n\n".join(f"[{chunk.id}] {chunk.text}" for chunk, _ in chunks)
    if not reference:
        reference = "(no reference material matched this question)"

    try:
        response = llm.invoke(
            [
                ("system", SYSTEM_PROMPT),
                (
                    "human",
                    f"Reference material:\n{reference}\n\nQuestion: {state['question']}",
                ),
            ]
        )
        text = response.content
        if isinstance(text, list):  # content blocks
            text = " ".join(b.get("text", "") for b in text if isinstance(b, dict)).strip()
        if not text:
            raise ValueError("empty response")
        return {"answer": str(text).strip(), "used_model": True, "notes": []}
    except Exception as exc:
        # A model failure must never take the endpoint down. Fall back and say so.
        _MODEL_BROKEN = True
        logger.warning(
            "Chat model call failed (%s); using the offline answer for the rest of "
            "this process",
            type(exc).__name__,
        )
        return {
            "answer": _extractive_answer(chunks),
            "used_model": False,
            "notes": ["The language model was unavailable - answered from the knowledge base."],
        }


# --- node 4: ground check ---------------------------------------------------

# Claims that must never appear unless the knowledge base actually supports them.
_RISKY_CLAIMS = (
    ("battery", "blue bin"),
    ("batteries", "blue bin"),
    ("styrofoam", "recyclable"),
)


def ground_check(state: ChatState) -> dict[str, Any]:
    """Verify the answer is anchored in retrieved material.

    Cheap and deterministic: it does not judge wording, only whether there was any
    supporting evidence and whether the answer contradicts the knowledge base on the
    handful of claims that are actively dangerous to get wrong.
    """
    chunks = state.get("chunks", [])
    answer = state.get("answer", "")
    notes = list(state.get("notes", []))

    if not chunks:
        notes.append("No supporting knowledge was found, so this answer is not sourced.")
        return {"grounded": False, "notes": notes}

    lowered = answer.lower()
    supporting = " ".join(chunk.text.lower() for chunk, _ in chunks)
    for subject, claim in _RISKY_CLAIMS:
        if subject in lowered and claim in lowered and claim not in supporting:
            logger.warning("Chat answer contradicted the knowledge base on %r", subject)
            notes.append(f"Answer overridden: unsupported claim about {subject}.")
            return {
                "answer": _extractive_answer(chunks),
                "grounded": True,
                "used_model": False,
                "notes": notes,
            }

    return {"grounded": True, "notes": notes}


# --- node 5: redirect -------------------------------------------------------


def redirect(state: ChatState) -> dict[str, Any]:
    return {
        "answer": (
            "I only cover recycling and waste disposal in Singapore. Ask me what goes in "
            "the blue bin, where to take e-waste, or what happens to your recycling."
        ),
        "chunks": [],
        "sources": [],
        "grounded": True,
        "used_model": False,
        "notes": ["Question was outside the assistant's scope."],
    }


# --- graph ------------------------------------------------------------------


def build_graph():
    graph = StateGraph(ChatState)
    graph.add_node("classify", classify)
    graph.add_node("retrieve", retrieve)
    graph.add_node("generate", generate)
    graph.add_node("ground_check", ground_check)
    graph.add_node("redirect", redirect)

    graph.add_edge(START, "classify")
    graph.add_conditional_edges("classify", route_after_classify)
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "ground_check")
    graph.add_edge("ground_check", END)
    graph.add_edge("redirect", END)

    return graph.compile()


_COMPILED = None


def reset_model_state() -> None:
    """Clear the broken-model latch. For tests, and for retrying after fixing a key."""
    global _MODEL_BROKEN
    _MODEL_BROKEN = False


def get_graph():
    """Compiled once and reused - compiling per request is pure overhead."""
    global _COMPILED
    if _COMPILED is None:
        _COMPILED = build_graph()
    return _COMPILED


def ask(question: str) -> ChatState:
    return get_graph().invoke({"question": question, "notes": []})
