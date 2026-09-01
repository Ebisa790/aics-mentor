import uuid
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict

from app.models.announcement import AnnouncementType


class AnnouncementCreate(BaseModel):
    """
    Payload for creating a new system-wide or targeted announcement.
    """
    title: str = Field(min_length=1, max_length=255, description="Announcement headline or title")
    content: str = Field(min_length=1, description="Markdown-formatted body content of the announcement")
    announcement_type: AnnouncementType = Field(
        AnnouncementType.PLATFORM_NEWS, description="Category classification of the announcement"
    )
    is_pinned: bool = Field(False, description="Flag indicating whether to pin the announcement to the top")


class AnnouncementUpdate(BaseModel):
    """
    Payload for selectively updating an existing announcement.
    """
    title: str | None = Field(None, min_length=1, max_length=255, description="Updated headline")
    content: str | None = Field(None, min_length=1, description="Updated body content")
    announcement_type: AnnouncementType | None = Field(None, description="Updated announcement category")
    is_pinned: bool | None = Field(None, description="Updated pin status flag")


class AnnouncementOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    announcement_type: AnnouncementType
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)