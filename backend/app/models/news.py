from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import utcnow


class NewsArticle(SQLModel, table=True):
    __tablename__ = "news_articles"

    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(max_length=300)
    description: str | None = Field(default=None, max_length=1000)
    url: str = Field(unique=True, max_length=600)
    image_url: str | None = Field(default=None, max_length=600)
    source: str | None = Field(default=None, max_length=120)
    category: str | None = Field(default=None, index=True, max_length=60)
    published_at: datetime | None = Field(default=None, index=True)
    fetched_at: datetime = Field(default_factory=utcnow)
