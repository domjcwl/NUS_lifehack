"""Wiring the nodes into a LangGraph state machine.

    contextualize        resolve "what about the charger?" into a standalone question
         |
      classify           which kind of question, and what context to gather
         |
         +--- out of scope ---> refuse ----------------------+
         |                                                   |
      retrieve           BM25 over the knowledge base        |
         |                                                   |
  resolve_location       a named place ("raffles hall")      |
         |               into coordinates, when the device   |
         |               shared none                         |
         |                                                   |
     find_bins           nearest NEA points, when asked      |
         |                                                   |
      generate           one model call, or the offline answer
         |                                                   |
    ground_check         is the answer backed by what we retrieved
         |                                                   |
         +---------------------------------------------------+---> END

Why a graph rather than one call: `retrieve`, `find_bins` and `ground_check` are
separate, inspectable steps that run identically with or without an API key.
`contextualize` and `generate` are the only nodes that need one, so losing the key
degrades the wording and never the correctness.

`retrieve` and the location pair run in sequence rather than in parallel. Both are local
lookups measured in milliseconds, so a fan-out would buy no latency and would cost
a merge node plus state reducers. What matters is that both can run for a single
question — "where do I throw my old phone?" needs the e-waste rule AND the bin list.
"""

from langgraph.graph import END, START, StateGraph

from app.graph import nodes
from app.graph.state import ChatState


def build_graph():
    graph = StateGraph(ChatState)

    graph.add_node("contextualize", nodes.contextualize)
    graph.add_node("classify", nodes.classify)
    graph.add_node("retrieve", nodes.retrieve)
    graph.add_node("resolve_location", nodes.resolve_location)
    graph.add_node("find_bins", nodes.find_bins)
    graph.add_node("generate", nodes.generate)
    graph.add_node("ground_check", nodes.ground_check)
    graph.add_node("refuse", nodes.refuse)

    graph.add_edge(START, "contextualize")
    graph.add_edge("contextualize", "classify")
    graph.add_conditional_edges(
        "classify",
        nodes.route_after_classify,
        {"retrieve": "retrieve", "refuse": "refuse"},
    )
    graph.add_edge("retrieve", "resolve_location")
    graph.add_edge("resolve_location", "find_bins")
    graph.add_edge("find_bins", "generate")
    graph.add_edge("generate", "ground_check")
    graph.add_edge("ground_check", END)
    graph.add_edge("refuse", END)

    return graph.compile()


_COMPILED = None


def get_graph():
    """Compiled once and reused — compiling per request is pure overhead."""
    global _COMPILED
    if _COMPILED is None:
        _COMPILED = build_graph()
    return _COMPILED


def ask(
    messages: list[dict],
    latitude: float | None = None,
    longitude: float | None = None,
) -> ChatState:
    """Run one turn. `messages` is the whole conversation, oldest first."""
    return get_graph().invoke(
        {
            "messages": messages,
            "question": messages[-1]["content"],
            "latitude": latitude,
            "longitude": longitude,
            "notes": [],
        }
    )
