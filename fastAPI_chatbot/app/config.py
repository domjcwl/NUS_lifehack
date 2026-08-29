"""Application configuration.

Every value comes from the environment (or `.env`). Nothing here is a secret by
default — the defaults are chosen so a stranger can clone the repo and run the
service with no `.env` at all, which is what makes the demo survive a venue with
no wifi.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# fastAPI_chatbot/ — the package root, two levels up from this file.
ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "Floe recycling chatbot"
    ENV: str = "development"
    DEBUG: bool = True

    CORS_ORIGINS: str = "*"

    # --- OpenAI (optional — the service answers from the knowledge base without it)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    # Short answers by construction: the person is standing at a bin.
    CHAT_MAX_TOKENS: int = 250
    CHAT_TIMEOUT_SECONDS: float = 20.0

    # --- Data ---------------------------------------------------------------
    # The bin dataset lives in web/ and is shared, not copied. 13,004 real NEA
    # points fetched from data.gov.sg by scripts/fetch-bins.py at the repo root.
    BINS_PATH: str = str(ROOT.parent / "web" / "data" / "bins.json")
    # NEA document chunks produced by scripts/ingest.py. Committed, never fetched
    # at request time.
    CHUNKS_PATH: str = str(ROOT / "data" / "chunks.json")

    # Resolved place names, cached to disk by app/tools/geocode.py so a lookup
    # that worked once on wifi keeps working with the network down.
    PLACES_PATH: str = str(ROOT / "data" / "places.json")
    # OneMap is a nice-to-have on the critical path, so it gets a short leash:
    # better to ask the user for a postal code than to stall the answer.
    GEOCODE_TIMEOUT_SECONDS: float = 6.0
    GEOCODE_ENABLED: bool = True
    # Optional. OneMap has better Singapore coverage but its tokens expire
    # every few days; absent, Nominatim (no key) is used instead.
    ONEMAP_TOKEN: str = ""

    # How many bins to return for a location question. Three fits on a phone
    # screen without scrolling.
    NEAREST_LIMIT: int = 3

    @property
    def cors_origins(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def openai_enabled(self) -> bool:
        return bool(self.OPENAI_API_KEY.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
