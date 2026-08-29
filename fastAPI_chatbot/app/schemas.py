"""Request and response models for the chatbot.

The request takes the whole conversation rather than a single message. That is what
`web/src/app/chat/page.tsx` already sends, and a single-message API cannot resolve
"what about the charger?" at all.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Location(BaseModel):
    latitude: float = Field(ge=-90, le=90, examples=[1.3489])
    longitude: float = Field(ge=-180, le=180, examples=[103.9412])


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(
        min_length=1,
        max_length=40,
        description="The conversation so far, oldest first. The last message must "
        "be from the user.",
    )
    location: Location | None = Field(
        default=None,
        description="The user's coordinates, if they have shared them. Without "
        "this, location questions are answered by asking for a postal code.",
    )

    @field_validator("messages")
    @classmethod
    def last_is_user(cls, v: list[Message]) -> list[Message]:
        if v[-1].role != "user":
            raise ValueError("The last message must be from the user")
        if not v[-1].content.strip():
            raise ValueError("The last message cannot be blank")
        return v


class Source(BaseModel):
    id: str = Field(description="Knowledge-base chunk id.")
    topic: str
    title: str = Field(description="Human-readable source name.")
    url: str = Field(
        default="",
        description="The NEA page for this answer. When `quoted` is true the "
        "snippet is text taken from that page; otherwise it is the NEA page "
        "covering the topic, offered as further reading.",
    )
    quoted: bool = Field(
        default=False,
        description="True when the snippet is extracted verbatim from `url`. False "
        "when it is our own summary written from public guidance - do not present "
        "it to the user as an NEA quotation.",
    )
    snippet: str


class BinLocation(BaseModel):
    name: str
    kind: Literal["recycling", "ewaste"]
    postal: str
    streams: list[str]
    latitude: float
    longitude: float
    metres: int = Field(description="Straight-line distance from the user.")
    directions_url: str = Field(
        description="Opens the phone's maps app with walking directions."
    )


class ResolvedLocation(BaseModel):
    name: str = Field(
        description="The place the coordinates came from, e.g. 'Raffles Hall'."
    )
    latitude: float
    longitude: float
    source: str = Field(
        description="Where it was resolved: 'bins' (offline, from the NEA dataset), 'osm', 'onemap', or 'cache'."
    )


class ChatResponse(BaseModel):
    answer: str
    intent: str = Field(
        description="How the question was classified: disposal, ewaste, location, "
        "background or out_of_scope."
    )
    sources: list[Source] = Field(
        default_factory=list,
        description="The knowledge the answer was drawn from. Empty means the "
        "assistant had nothing to go on, and the answer says so.",
    )
    locations: list[BinLocation] = Field(
        default_factory=list,
        description="Nearby collection points, nearest first.",
    )
    resolved_location: ResolvedLocation | None = Field(
        default=None,
        description="Set when the coordinates came from a place the user named rather than from the device. Show it - it is how someone spots that we guessed the wrong place.",
    )
    needs_location: bool = Field(
        default=False,
        description="True when the user asked where something is but neither shared coordinates nor named a place we could resolve. Prompt for geolocation and send the message again.",
    )
    grounded: bool = Field(
        description="False when no supporting knowledge was found. Show the answer "
        "with less confidence when this is false."
    )
    used_model: bool = Field(
        description="True if a language model wrote the reply; false if it was "
        "answered directly from the knowledge base."
    )
    notes: list[str] = Field(
        default_factory=list,
        description="Diagnostics, e.g. that the model was unavailable. Safe to show.",
    )


class HealthResponse(BaseModel):
    status: str
    chunks: int = Field(description="Searchable knowledge chunks loaded.")
    bins: int = Field(description="Bin locations loaded from the shared dataset.")
    places_cached: int = Field(
        description="Place names resolved and cached to disk."
    )
    model_configured: bool = Field(
        description="False means the service answers from the knowledge base only."
    )
