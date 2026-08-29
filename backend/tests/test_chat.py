"""The LangGraph recycling chatbot.

Every test here runs the real graph. The generate node is the only part that can reach
the network, and it is stubbed or allowed to fail so the suite never needs a key.
"""

import pytest
from fastapi.testclient import TestClient

from app.agents.chatbot import graph, retrieval
from app.agents.chatbot.knowledge import KNOWLEDGE


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """No API key, so the graph takes its offline path. This is the demo path."""
    graph.reset_model_state()
    monkeypatch.setattr(graph, "_build_llm", lambda: None)
    yield
    graph.reset_model_state()


# --- retrieval --------------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "expected_id"),
    [
        ("Can I put a greasy pizza box in the blue recycling bin?", "pizza-box"),
        ("Where can I dispose of an old laptop?", "ewaste-laptop"),
        ("Can I recycle styrofoam?", "styrofoam"),
        ("Where should I throw away batteries?", "batteries"),
        ("What happens to my recycling after it goes into the blue bin?", "what-happens-next"),
        ("Why should I recycle electronics separately?", "ewaste-why-separate"),
        ("What items cannot go into Singapore's blue recycling bins?", "blue-bin-rejected"),
        ("is a milk carton recyclable", "beverage-carton"),
        ("how do I get rid of an old fridge", "large-appliances"),
        ("can I recycle my old t-shirts", "textiles"),
    ],
)
def test_retrieval_finds_the_right_chunk(question: str, expected_id: str):
    """These are the questions from the brief. The right chunk must rank first."""
    hits = retrieval.search(question)
    assert hits, f"nothing retrieved for {question!r}"
    assert hits[0][0].id == expected_id, [c.id for c, _ in hits]


def test_retrieval_returns_nothing_for_an_unrelated_question():
    """Scoring below the floor is what lets the agent admit ignorance."""
    assert retrieval.search("who won the world cup in 1998") == []


def test_retrieval_handles_empty_and_punctuation_only_input():
    assert retrieval.search("") == []
    assert retrieval.search("???") == []


def test_synonyms_are_expanded():
    # "handphone" is Singlish for a mobile phone and never appears in the corpus.
    hits = retrieval.search("where do I throw my old handphone")
    assert hits and hits[0][0].id == "ewaste-phone"


# --- classification ---------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "category"),
    [
        ("Can I recycle this plastic container?", "disposal"),
        ("Where is the nearest e-waste bin?", "location"),
        ("What happens to recycling in Singapore?", "background"),
        ("What is the capital of France?", "out_of_scope"),
        ("Write me a poem about my cat", "out_of_scope"),
    ],
)
def test_classification(question: str, category: str):
    assert graph.classify({"question": question})["category"] == category


# --- the graph end to end ---------------------------------------------------


def test_graph_answers_a_disposal_question_from_the_knowledge_base():
    state = graph.ask("Can I put a greasy pizza box in the blue recycling bin?")
    assert state["grounded"] is True
    assert state["used_model"] is False
    assert "pizza-box" in state["sources"]
    assert "general waste" in state["answer"].lower()


def test_graph_answers_the_keyboard_question_from_the_demo_script():
    state = graph.ask("Where can I recycle my old keyboard?")
    assert "e-waste" in state["answer"].lower()
    assert state["grounded"] is True
    # Only the best chunk is quoted, so the verdict is not buried.
    assert "semakau" not in state["answer"].lower()


def test_graph_admits_when_it_does_not_know():
    """The single most important behaviour: never invent a disposal instruction."""
    state = graph.ask("How do I dispose of radioactive waste from my reactor?")
    assert state["grounded"] is False
    answer = state["answer"].lower()
    assert "don't have reliable information" in answer or "not sure" in answer
    assert state["sources"] == []


def test_out_of_scope_questions_are_redirected_without_retrieval():
    state = graph.ask("What is the capital of France?")
    assert state["category"] == "out_of_scope"
    assert state["sources"] == []
    assert "recycling" in state["answer"].lower()
    # The redirect must not pretend to be an answer.
    assert "paris" not in state["answer"].lower()


def test_graph_reports_that_no_model_was_used():
    state = graph.ask("Can I recycle glass jars?")
    assert state["used_model"] is False
    assert any("knowledge base" in note for note in state["notes"])


def test_a_model_failure_falls_back_instead_of_erroring(monkeypatch):
    """An invalid key or dead network must degrade the wording, never the endpoint."""

    class Exploding:
        def invoke(self, *_args, **_kwargs):
            raise RuntimeError("401 invalid api key")

    monkeypatch.setattr(graph, "_build_llm", lambda: Exploding())

    state = graph.ask("Can I recycle styrofoam?")
    assert state["used_model"] is False
    assert state["grounded"] is True
    assert "styrofoam" in state["answer"].lower()
    assert any("unavailable" in note for note in state["notes"])


def test_a_working_model_is_used_and_reported(monkeypatch):
    class Fake:
        def invoke(self, messages, *_args, **_kwargs):
            # The reference material must actually reach the prompt.
            assert "Reference material:" in messages[1][1]
            assert "styrofoam" in messages[1][1].lower()

            class R:
                content = "No - styrofoam goes in general waste."

            return R()

    monkeypatch.setattr(graph, "_build_llm", lambda: Fake())

    state = graph.ask("Can I recycle styrofoam?")
    assert state["used_model"] is True
    assert state["answer"] == "No - styrofoam goes in general waste."


def test_ground_check_overrides_a_dangerous_unsupported_claim(monkeypatch):
    """If a model ever says batteries go in the blue bin, the graph must not ship it."""

    class Liar:
        def invoke(self, *_args, **_kwargs):
            class R:
                content = "Yes, you can put batteries in the blue bin."

            return R()

    monkeypatch.setattr(graph, "_build_llm", lambda: Liar())

    state = graph.ask("Where should I throw away batteries?")
    assert "blue bin" not in state["answer"].lower()
    assert state["used_model"] is False
    assert any("overridden" in note for note in state["notes"])


# --- the endpoint -----------------------------------------------------------


def test_chat_endpoint(client: TestClient):
    response = client.post("/chat", json={"message": "Can I recycle styrofoam?"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["answer"]
    assert body["category"] == "disposal"
    assert body["sources"][0]["id"] == "styrofoam"
    assert body["grounded"] is True


def test_chat_endpoint_rejects_blank_and_oversized_input(client: TestClient):
    assert client.post("/chat", json={"message": "   "}).status_code == 422
    assert client.post("/chat", json={"message": "a" * 501}).status_code == 422
    assert client.post("/chat", json={}).status_code == 422


def test_chat_endpoint_returns_sources_the_ui_can_show(client: TestClient):
    body = client.post("/chat", json={"message": "what cannot go in the blue bin"}).json()
    assert body["sources"]
    for source in body["sources"]:
        assert source["id"] and source["topic"] and source["text"]


# --- knowledge base integrity ----------------------------------------------


def test_knowledge_ids_are_unique():
    ids = [chunk.id for chunk in KNOWLEDGE]
    assert len(ids) == len(set(ids))


def test_every_chunk_is_retrievable_by_its_own_text():
    """A chunk nothing can reach is dead weight and a sign of a broken index."""
    for chunk in KNOWLEDGE:
        hits = retrieval.search(chunk.text[:120])
        assert chunk.id in [c.id for c, _ in hits], chunk.id


def test_chunks_read_as_complete_sentences():
    # They get quoted verbatim when no model is available, so they must stand alone.
    for chunk in KNOWLEDGE:
        assert chunk.text[0].isupper(), chunk.id
        assert chunk.text.rstrip().endswith("."), chunk.id
        assert len(chunk.text) > 80, chunk.id


def test_a_broken_model_is_not_retried_on_every_request(monkeypatch):
    """One bad key should cost one round trip per process, not one per question."""
    calls = {"n": 0}

    class Exploding:
        def invoke(self, *_args, **_kwargs):
            calls["n"] += 1
            raise RuntimeError("401")

    graph.reset_model_state()
    monkeypatch.setattr(graph, "_build_llm", lambda: Exploding())

    graph.ask("Can I recycle styrofoam?")
    graph.ask("Can I recycle glass?")
    graph.ask("Where do batteries go?")
    assert calls["n"] == 1, "the model was retried after it had already failed"
