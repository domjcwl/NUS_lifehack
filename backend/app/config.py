"""Application configuration.

Every value comes from the environment (or `.env`). Nothing here is a secret by default -
the defaults are chosen so a stranger can clone the repo and run the app with no `.env` at
all, which is what makes the demo survive a venue with no wifi.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- App ---------------------------------------------------------------
    # Rename the product in this one place.
    APP_NAME: str = "BinBuddy"
    ENV: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = ""

    # --- Database ----------------------------------------------------------
    # Swap to postgresql+psycopg://user:pass@host/db for a production-style run.
    DATABASE_URL: str = "sqlite:///./binbuddy.db"

    # --- Auth --------------------------------------------------------------
    # Intentionally absent. Team decision 29 Aug 2026: no authentication. Callers
    # identify themselves with ?user_id= or X-User-Id. See planning/02-auth-decision.md.

    # --- CORS --------------------------------------------------------------
    CORS_ORIGINS: str = "*"  # comma-separated, or "*"

    # --- External APIs (all optional - every one has a working fallback) ----
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_VISION_MODEL: str = "gpt-4o-mini"
    MAPS_API_KEY: str = ""
    NEWS_API_KEY: str = ""

    # --- QR codes ----------------------------------------------------------
    # What gets encoded in a printed sticker: {QR_BASE_URL}/recycle/{qr_code_id}.
    # Must be reachable from a phone - "localhost" resolves to the phone itself.
    # Override with scripts/generate_qr.py --base-url http://<laptop-lan-ip>:5173
    QR_BASE_URL: str = "http://localhost:5173"

    # --- Storage -----------------------------------------------------------
    STORAGE_BACKEND: str = "local"  # local | s3
    STORAGE_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 25
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp,image/heic"
    ALLOWED_VIDEO_TYPES: str = "video/mp4,video/quicktime,video/webm"

    # --- Gamification (tuned in one place, never hard-coded downstream) -----
    POINTS_RECYCLING: int = 10
    POINTS_EWASTE: int = 20
    POINTS_FIRST_SUBMISSION_BONUS: int = 25
    PET_LEVEL_THRESHOLDS: str = "100,250,500,1000,2000,3500,5000"
    PET_XP_PER_POINT: int = 1
    PET_HUNGER_PER_HOUR: float = 1.5  # hunger climbs 0 -> 100 in roughly 3 days
    PET_HEALTH_LOSS_PER_HOUR_STARVING: float = 2.0

    # --- Anti-abuse --------------------------------------------------------
    SUBMISSION_COOLDOWN_MINUTES: int = 60  # per user, per bin
    MAX_SUBMISSIONS_PER_DAY: int = 10
    VERIFICATION_MIN_SCORE: float = 0.5

    # --- Derived helpers ---------------------------------------------------
    @property
    def cors_origins(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def pet_level_thresholds(self) -> list[int]:
        return [int(x) for x in self.PET_LEVEL_THRESHOLDS.split(",") if x.strip()]

    @property
    def allowed_image_types(self) -> set[str]:
        return {t.strip() for t in self.ALLOWED_IMAGE_TYPES.split(",") if t.strip()}

    @property
    def allowed_video_types(self) -> set[str]:
        return {t.strip() for t in self.ALLOWED_VIDEO_TYPES.split(",") if t.strip()}

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def openai_enabled(self) -> bool:
        return bool(self.OPENAI_API_KEY.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
