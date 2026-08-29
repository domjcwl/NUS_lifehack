"""Tests for the chatbot.

These run OFFLINE by design — no API key, no network. That is not a limitation of
the tests, it is the property being tested: retrieval, routing, the bin finder and
the ground check must all be correct without a model, because that is the path the
demo falls back to.

The negative retrieval cases are the important ones. Anyone can make a retriever
return something; the floor that makes it return NOTHING for an unanswerable
question is what lets the assistant admit it does not know.
"""

import pytest
from fastapi.testclient import TestClient

from app.graph import build, nodes
from app.graph.places import extract_place
from app.main import app
from app.rag import retrieval
from app.tools import bins as bin_tool
from app.tools import geocode

# Blk 826A Tampines Street 81 — the demo scan anchor from docs/decisions.md.
TAMPINES = (1.3489, 103.9412)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Force the offline path regardless of the developer's environment."""
    monkeypatch.setattr(nodes.settings, "OPENAI_API_KEY", "")
    nodes.reset_model_state()


@pytest.fixture
def client():
    return TestClient(app)


def ask(question, history=None, coords=None):
    messages = list(history or []) + [{"role": "user", "content": question}]
    lat, lng = coords or (None, None)
    return build.ask(messages, lat, lng)


# --- retrieval --------------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("Can I recycle a pizza box?", "pizza-box"),
        ("Is Styrofoam recyclable?", "styrofoam"),
        ("Can I put plastic bags in the blue bin?", "plastic-bags"),
        ("How do I dispose of a broken laptop?", "ewaste-laptop"),
        ("Can I recycle batteries?", "batteries"),
        ("What should I do with an old television?", "large-appliances"),
        ("I have a bunch of old cables, where do they go?", "ewaste-keyboard"),
        ("What items can go into a blue recycling bin?", "blue-bin-accepted"),
        ("Do I need to rinse this can?", "contamination"),
        ("What happens to my recycling after it is collected?", "what-happens-next"),
    ],
)
def test_retrieval_finds_the_right_chunk(question, expected):
    assert expected in [chunk.id for chunk, _ in retrieval.search(question)]


@pytest.mark.parametrize(
    "question",
    [
        "Who won the world cup?",
        "What is the capital of France?",
        "Write me a poem about the sea",
        "How do I invert a binary tree?",
    ],
)
def test_retrieval_returns_nothing_when_it_knows_nothing(question):
    """The score floor. Without this the assistant cannot say 'I don't know'."""
    assert retrieval.search(question) == []


# --- routing ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "intent"),
    [
        ("Can I recycle a pizza box?", "disposal"),
        ("How do I dispose of a broken laptop?", "ewaste"),
        ("Where is the nearest e-waste bin?", "location"),
        ("Who won the world cup?", "out_of_scope"),
    ],
)
def test_intent(question, intent):
    assert ask(question)["intent"] == intent


def test_out_of_scope_refuses_without_retrieving():
    state = ask("Who won the world cup?")
    assert state["chunks"] == []
    assert "recycling and waste disposal" in state["answer"]


# --- the bin finder ---------------------------------------------------------


def test_dataset_loaded():
    """Guards against a bad BINS_PATH, which is otherwise invisible until demo time."""
    assert bin_tool.count() > 10_000


def test_nearest_ewaste_bin_is_found_and_ordered():
    state = ask("Where is the nearest e-waste bin?", coords=TAMPINES)
    found = state["bins"]
    assert found, "expected e-waste bins near Tampines"
    assert all(n.bin.kind == "ewaste" for n in found)
    assert [n.metres for n in found] == sorted(n.metres for n in found)
    assert found[0].directions_url.startswith("https://www.google.com/maps/dir/")


def test_asks_for_a_location_when_none_was_shared():
    state = ask("Where is the nearest e-waste bin?")
    assert state["needs_location"] is True
    assert state["bins"] == []
    assert "postal code" in state["answer"]


def test_a_disposal_question_does_not_demand_a_location():
    """'Where does a pizza box go?' is a disposal question, not a location one."""
    state = ask("Where does a greasy pizza box go?")
    assert state["needs_location"] is False


def test_ewaste_question_with_coords_returns_both_rule_and_bins():
    """The case a single-branch router gets wrong: it is two questions at once."""
    state = ask("Where can I throw away my old phone?", coords=TAMPINES)
    assert "ewaste-phone" in [c.id for c, _ in state["chunks"]]
    assert state["bins"] and state["bins"][0].bin.kind == "ewaste"


# --- conversational context -------------------------------------------------


def test_follow_up_resolves_against_the_previous_turn():
    history = [
        {"role": "user", "content": "Can I recycle an old laptop?"},
        {"role": "assistant", "content": "Laptops are e-waste."},
    ]
    state = ask("What about the charger?", history=history)
    # ewaste-keyboard is the chunk covering cables and chargers.
    assert "ewaste-keyboard" in [c.id for c, _ in state["chunks"]]


def test_bare_follow_up_falls_back_to_the_earlier_question():
    history = [
        {"role": "user", "content": "Can I recycle an old laptop?"},
        {"role": "assistant", "content": "Laptops are e-waste."},
    ]
    state = ask("Is it recyclable?", history=history)
    assert state["chunks"], "a bare pronoun question should inherit its subject"
    assert "ewaste-laptop" in [c.id for c, _ in state["chunks"]]


def test_follow_up_inherits_bin_kind():
    history = [
        {"role": "user", "content": "How do I dispose of a broken laptop?"},
        {"role": "assistant", "content": "Laptops are e-waste."},
    ]
    state = ask("Where can I drop it off?", history=history, coords=TAMPINES)
    assert state["bins"] and all(n.bin.kind == "ewaste" for n in state["bins"])


# --- grounding --------------------------------------------------------------


def test_unanswerable_question_is_flagged_ungrounded():
    state = ask("How should I dispose of a nuclear reactor?")
    assert state["grounded"] is False
    assert state["chunks"] == []


def test_offline_answers_are_reported_as_such():
    state = ask("Is Styrofoam recyclable?")
    assert state["used_model"] is False
    assert state["notes"]


def test_ground_check_overrides_an_unsupported_dangerous_claim():
    """A model claiming batteries go in the blue bin must be overridden."""
    chunks = retrieval.search("Can I recycle batteries?")
    state = {
        "answer": "Yes, you can put batteries in the blue bin.",
        "chunks": chunks,
        "notes": [],
    }
    result = nodes.ground_check(state)
    assert "blue bin" not in result["answer"].lower()
    assert any("overridden" in n for n in result["notes"])


# --- the API ----------------------------------------------------------------


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["chunks"] > 20
    assert body["bins"] > 10_000


def test_chat_endpoint_returns_the_full_schema(client):
    response = client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Where can I throw my old phone?"}],
            "location": {"latitude": TAMPINES[0], "longitude": TAMPINES[1]},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "ewaste"
    assert body["sources"] and body["sources"][0]["title"]
    assert body["locations"] and body["locations"][0]["metres"] >= 0
    assert body["locations"][0]["directions_url"].startswith("https://")
    assert body["grounded"] is True


def test_chat_rejects_an_empty_conversation(client):
    assert client.post("/chat", json={"messages": []}).status_code == 422


def test_chat_rejects_a_trailing_assistant_message(client):
    response = client.post(
        "/chat",
        json={"messages": [{"role": "assistant", "content": "Hello"}]},
    )
    assert response.status_code == 422


# --- citations --------------------------------------------------------------


def test_curated_answers_cite_an_nea_page_but_not_as_a_quotation(client):
    body = client.post(
        "/chat", json={"messages": [{"role": "user", "content": "Is Styrofoam recyclable?"}]}
    ).json()
    source = body["sources"][0]
    assert source["url"].startswith("https://www.nea.gov.sg/")
    # Our own wording, so it must not be presented as an NEA quotation.
    assert source["quoted"] is False


def test_ingested_nea_chunks_are_marked_as_quoted():
    """Questions the curated tier does not cover fall through to real NEA text."""
    from app.rag import retrieval, store

    hits = retrieval.search("What is the extended producer responsibility scheme?")
    assert hits, "expected the ingested NEA pages to cover EPR"
    chunk = hits[0][0]
    _title, url, quoted = store.source_of(chunk)
    assert quoted is True
    assert url.startswith("https://www.nea.gov.sg/")


def test_every_ingested_chunk_carries_a_source():
    from app.rag import store

    ingested = [c for c in store.corpus() if c.source_url]
    assert ingested, "ingest.py has not been run - data/chunks.json is missing"
    assert all(c.source_title and c.source_url for c in ingested)


# --- naming a place instead of sharing coordinates --------------------------
#
# These never touch the network. The geocoder is stubbed where a lookup would
# happen, and the postal-code path genuinely is offline - it reads the bin
# dataset. A test suite that needs wifi is a test suite nobody runs at 3am.


@pytest.fixture
def offline_geocoder(monkeypatch):
    """Block outbound geocoding; only the local layers stay live."""
    monkeypatch.setattr(geocode.settings, "GEOCODE_ENABLED", False)
    geocode.reset()
    monkeypatch.setattr(geocode, "_cache", {})
    yield
    geocode.reset()


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("I stay at raffles hall Singapore, where can i throw my old laptop", "raffles hall"),
        ("I'm at Raffles Hall, where do I throw my laptop?", "Raffles Hall"),
        ("Find me a recycling bin near NUS", "NUS"),
        ("I live in Bishan, where can I recycle glass?", "Bishan"),
        ("My postal code is 521826, where is the nearest bin?", "521826"),
    ],
)
def test_place_is_extracted(question, expected):
    assert extract_place(question) == expected


@pytest.mark.parametrize(
    "question",
    [
        # The dangerous direction. Geocoding "the blue bin" would send someone
        # across the island; asking for a postal code is always the better failure.
        "Can I put plastic bags in the blue bin?",
        "Should I rinse the container in the sink?",
        "What goes in the recycling bin?",
        "can i throw batteries in general waste",
        "I am in Singapore, is styrofoam recyclable?",
        "Where does a greasy pizza box go?",
    ],
)
def test_waste_talk_is_never_mistaken_for_a_place(question):
    assert extract_place(question) is None


def test_postal_code_resolves_offline_from_the_bin_dataset(offline_geocoder):
    place = geocode.geocode("521826")
    assert place is not None
    assert place.source == "bins"
    assert 1.34 < place.latitude < 1.36


def test_bin_name_matching_requires_whole_words(offline_geocoder):
    """Regression: a substring match mapped "NUS" onto "Coralinus", 15 km away."""
    place = geocode.geocode("NUS")
    assert place is None or "coralinus" not in place.name.lower()


def test_named_place_produces_bins_without_any_coordinates(monkeypatch):
    """The reported bug: "I stay at Raffles Hall" used to ask for a postal code."""
    monkeypatch.setattr(
        geocode,
        "geocode",
        lambda q: geocode.Place("Raffles Hall", 1.30015, 103.77341, "", "stub"),
    )
    monkeypatch.setattr(nodes.geocode, "geocode", geocode.geocode)

    state = ask("I stay at raffles hall Singapore, where can i throw my old laptop")
    assert state["place_query"] == "raffles hall"
    assert state["needs_location"] is False
    assert state["bins"], "expected bins near the resolved place"
    assert state["resolved_place"].name == "Raffles Hall"
    # Kent Ridge is the NUS campus e-waste point; anything on the other side of
    # the island means the place was resolved wrongly.
    assert state["bins"][0].metres < 3000


def test_stated_place_and_intent_to_dispose_needs_no_location_word(monkeypatch):
    """"I am at Raffles Hall and I want to dispose some old cables" says neither
    "where" nor "nearest", so it used to skip the bin lookup entirely and answer
    "I'm not sure where the nearest one is, check the NEA website"."""
    monkeypatch.setattr(
        nodes.geocode,
        "geocode",
        lambda q: geocode.Place("Raffles Hall", 1.30015, 103.77341, "", "stub"),
    )
    state = ask("I am at raffles hall and I want to dispose some old cables")
    assert state["place_query"] == "raffles hall"
    assert state["needs_bins"] is True
    assert state["needs_location"] is False
    assert state["bin_kind"] == "ewaste"
    assert state["bins"], "expected e-waste points near the resolved place"
    assert state["bins"][0].metres < 3000
    assert state["resolved_place"].name == "Raffles Hall"


def test_disposal_intent_alone_does_not_ask_for_a_location(monkeypatch):
    """The new trigger must never interrupt someone who never said where they are:
    a plain "can I recycle this?" is still a knowledge question, not a map query."""
    called = []
    monkeypatch.setattr(nodes.geocode, "geocode", lambda q: called.append(q) or None)
    state = ask("I want to dispose some old cables")
    assert state["needs_bins"] is False
    assert state["needs_location"] is False
    assert called == [], "should not geocode when no place was named"


def test_a_place_named_earlier_carries_into_a_follow_up(monkeypatch):
    monkeypatch.setattr(
        nodes.geocode,
        "geocode",
        lambda q: geocode.Place("Raffles Hall", 1.30015, 103.77341, "", "stub"),
    )
    history = [
        {"role": "user", "content": "I stay at raffles hall, can I recycle an old laptop?"},
        {"role": "assistant", "content": "Laptops are e-waste."},
    ]
    state = ask("Where can I drop it off?", history=history)
    assert state["place_query"] == "raffles hall"
    assert state["bins"]


def test_device_coordinates_beat_a_named_place(monkeypatch):
    """If the phone shared a position, text is not allowed to override it."""
    called = []
    monkeypatch.setattr(
        nodes.geocode, "geocode", lambda q: called.append(q) or None
    )
    state = ask(
        "I stay at raffles hall, where is the nearest e-waste bin?", coords=TAMPINES
    )
    assert called == [], "should not geocode when coordinates were supplied"
    assert state["resolved_place"] is None
    assert state["bins"][0].metres < 1000  # Tampines, not Kent Ridge


def test_unresolvable_place_still_asks_rather_than_guessing(monkeypatch):
    monkeypatch.setattr(nodes.geocode, "geocode", lambda q: None)
    state = ask("I stay at zzzqqq nowhere, where is the nearest e-waste bin?")
    assert state["needs_location"] is True
    assert state["bins"] == []


def test_api_exposes_the_resolved_location(client, monkeypatch):
    monkeypatch.setattr(
        nodes.geocode,
        "geocode",
        lambda q: geocode.Place("Raffles Hall", 1.30015, 103.77341, "", "stub"),
    )
    body = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "I stay at raffles hall, where do I throw my laptop?"}
            ]
        },
    ).json()
    assert body["resolved_location"]["name"] == "Raffles Hall"
    assert body["needs_location"] is False
    assert body["locations"]
