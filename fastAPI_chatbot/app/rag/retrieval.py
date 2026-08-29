"""Retrieval over the knowledge base.

BM25-style lexical scoring in pure Python. No vector database, no embedding API call,
no extra dependency, and it works with the wifi off - which matters because the offline
path is the one the demo actually runs on.

For roughly thirty curated, single-topic chunks this retrieves as well as embeddings
would. Embeddings earn their cost at thousands of chunks with paraphrase-heavy queries;
here the vocabulary is small and largely shared between question and answer.

The score floor is the other reason to keep it. A question the corpus never covers
scores below MIN_SCORE everywhere and returns nothing, which is what lets the agent
say it does not know. Cosine similarity always returns a nearest neighbour however
irrelevant, so an embedding retriever would need a calibrated threshold to match this.

If ingestion ever pushes the corpus past a few hundred chunks, swap the body of
`search()` for embeddings behind this same signature. Nothing upstream changes.
"""

import math
import re
from collections import Counter
from functools import lru_cache

from app.rag import store
from app.rag.knowledge import Chunk

# BM25 constants. k1 controls term-frequency saturation, b the length normalisation.
_K1 = 1.5
_B = 0.75

# Words carrying no signal for this corpus. Kept short on purpose: an over-eager stop
# list removes the very words that distinguish "can I" questions from "where" ones.
_STOPWORDS = frozenset(
    """a an and are as at be but by can could do does for from had has have how i if in
    into is it its me my of on or should so than that the their then there these they
    this to was what when where which who will with would you your""".split()
)

_TOKEN = re.compile(r"[a-z0-9]+")

# Added per distinct query term matching a chunk's declared keywords, scaled by how
# rare that keyword is across the corpus.
_KEYWORD_BONUS = 9.0
# Below this, the match is coincidental prose overlap rather than a real answer.
# Tuned against the question set in tests/test_chat.py, positives and negatives.
MIN_SCORE = 6.0

# Common phrasings mapped onto the vocabulary the knowledge base actually uses.
_SYNONYMS = {
    "handphone": "phone",
    "hp": "phone",
    "laptop": "laptop computer",
    "pc": "computer",
    "rubbish": "waste",
    "trash": "waste",
    "garbage": "waste",
    "bin": "bin",
    "recycleable": "recyclable",
    "recyclables": "recyclable",
    "ewaste": "e waste",
    "throw": "dispose",
    "chuck": "dispose",
    "tin": "can tin metal",
    "styrofoam": "styrofoam polystyrene foam",
    "aircon": "aircon air conditioner",
    "goes": "go",
    "tshirt": "shirt",
}


def _stem(word: str) -> str:
    """Crude suffix stripping - enough for "shirts"/"shirt" and "separately"/"separate".

    Deliberately conservative: a real stemmer would map "glass" to "glas" and break
    matching on a material this corpus cares about.
    """
    if len(word) > 4 and word.endswith("ly"):
        word = word[:-2]
    if len(word) > 5 and word.endswith("ing"):
        word = word[:-3]
    if len(word) > 3 and word.endswith("s") and not word.endswith(("ss", "us")):
        word = word[:-1]
    return word


def tokenize(text: str) -> list[str]:
    expanded: list[str] = []
    for raw in _TOKEN.findall(text.lower()):
        expanded.extend(_SYNONYMS.get(raw, raw).split())
    return [_stem(t) for t in expanded if t not in _STOPWORDS and len(t) > 1]


def _chunk_terms(chunk: Chunk) -> list[str]:
    return tokenize(chunk.text)


def _keyword_tokens(chunk: Chunk) -> frozenset[str]:
    """The terms a user actually types for this chunk, as a set for exact matching."""
    return frozenset(tokenize(" ".join(chunk.keywords)))


@lru_cache(maxsize=1)
def _index() -> tuple[
    list[tuple[Chunk, Counter, frozenset]], dict[str, float], float, dict[str, float]
]:
    """Build the term counts, keyword sets, IDFs, average length and keyword weights."""
    documents = [
        (chunk, Counter(_chunk_terms(chunk)), _keyword_tokens(chunk))
        for chunk in store.corpus()
    ]
    total = len(documents)
    average_length = sum(sum(counts.values()) for _, counts, _kw in documents) / total

    document_frequency: Counter = Counter()
    for _, counts, _keywords in documents:
        document_frequency.update(counts.keys())

    idf = {
        term: math.log(1 + (total - freq + 0.5) / (freq + 0.5))
        for term, freq in document_frequency.items()
    }

    # How many chunks declare each keyword. "blue" and "bin" are declared all over the
    # corpus and say almost nothing about which chunk answers the question; "styrofoam"
    # is declared once and is decisive. Weighting by rarity is what stops the generic
    # overview chunks outranking the specific answer.
    keyword_frequency: Counter = Counter()
    for _chunk, _counts, keywords in documents:
        keyword_frequency.update(keywords)

    keyword_weight = {term: 1.0 / count for term, count in keyword_frequency.items()}
    return documents, idf, average_length, keyword_weight


def reset() -> None:
    """Drop the cached index. Call after changing the corpus."""
    _index.cache_clear()
    store.reset()


def search(
    question: str, limit: int = 3, min_score: float = MIN_SCORE
) -> list[tuple[Chunk, float]]:
    """Best-matching chunks, highest score first.

    Score = BM25 over the chunk text, plus a fixed bonus per distinct query term that
    exactly matches one of the chunk's declared keywords.

    The keyword bonus is what makes purely lexical retrieval safe enough here. BM25 on
    text alone confuses "who won the world **cup**" with the styrofoam chunk, which
    mentions "cup lids" - a real failure this fixes. Declared keywords are the terms
    people actually type, so matching them is strong evidence; matching a word buried in
    prose is weak evidence.

    `min_score` is what lets the agent admit it does not know: a question the knowledge
    base never covers scores below the floor everywhere and returns nothing, rather than
    the least-bad chunk.
    """
    query = tokenize(question)
    if not query:
        return []

    documents, idf, average_length, keyword_weight = _index()
    distinct = set(query)

    scored: list[tuple[Chunk, float]] = []
    for chunk, counts, keywords in documents:
        length = sum(counts.values())
        score = 0.0
        for term in query:
            frequency = counts.get(term, 0)
            if not frequency:
                continue
            numerator = frequency * (_K1 + 1)
            denominator = frequency + _K1 * (1 - _B + _B * length / average_length)
            score += idf.get(term, 0.0) * numerator / denominator

        score += _KEYWORD_BONUS * sum(
            keyword_weight.get(term, 1.0) for term in distinct & keywords
        )

        if score > 0:
            scored.append((chunk, round(score, 3)))

    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [pair for pair in scored[:limit] if pair[1] >= min_score]
