import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Text, DateTime, Boolean, ForeignKey, Enum, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class AnnouncementType(str, enum.Enum):
    MOE_UPDATE = "moe_update"  # Ministry of Education updates
    EXAM_NOTICE = "exam_notice"
    PLATFORM_NEWS = "platform_news"


class Announcement(Base):
    """
    Platform-wide announcements, Ministry of Education notices, and exit exam updates.
    """

    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    announcement_type: Mapped[AnnouncementType] = mapped_column(
        Enum(AnnouncementType, name="announcement_type"),
        default=AnnouncementType.PLATFORM_NEWS,
        nullable=False,
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )  # Pinned announcements sort first

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False,
    )

    # Relationships
    created_by: Mapped[Optional["User"]] = relationship("User")

    # Composite index for instant feed sorting (Pinned first, then newest)
    __table_args__ = (
        Index("ix_announcements_pinned_created", "is_pinned", "created_at"),
    )