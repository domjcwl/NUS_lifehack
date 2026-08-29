"""Request and response models for the chatbot."""

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=2,
        max_length=500,
        description="The user's question.",
        examples=["Where can I recycle my old keyboard?"],
    )

    @field_validator("message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Message cannot be blank")
        return cleaned


class ChatSource(BaseModel):
    id: str = Field(description="Knowledge-base chunk id.")
    topic: str
    text: str


class ChatResponse(BaseModel):
    answer: str
    category: str = Field(
        description="How the question was classified: disposal, location, background "
        "or out_of_scope."
    )
    sources: list[ChatSource] = Field(
        description="The knowledge the answer was drawn from. Empty means the assistant "
        "had nothing to go on, and the answer says so."
    )
    grounded: bool = Field(
        description="False when no supporting knowledge was found. Show the answer with "
        "less confidence when this is false."
    )
    used_model: bool = Field(
        description="True if a language model wrote the reply; false if it was answered "
        "directly from the knowledge base."
    )
    notes: list[str] = Field(
        default_factory=list,
        description="Diagnostics, e.g. that the model was unavailable. Safe to show.",
    )
