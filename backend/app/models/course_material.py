import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, Enum, Boolean, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class MaterialContentType(str, enum.Enum):
    NOTE = "note"
    SUMMARY = "summary"
    SLIDE_DECK = "slide_deck"


class CourseMaterial(Base):
    """
    Admin-authored study content stored as Markdown (typed or AI-drafted directly in
    the admin panel). Distinct from LearningMaterial, which holds uploaded files — 
    this table stores structured platform text content.
    """

    __tablename__ = "course_materials"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Markdown text
    material_type: Mapped[MaterialContentType] = mapped_column(
        Enum(MaterialContentType, name="material_content_type", values_callable=lambda x: [e.value for e in x]),
        default=MaterialContentType.NOTE,
        nullable=False,
    )
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
    course: Mapped["Course"] = relationship("Course", back_populates="study_materials")
    created_by: Mapped[Optional["User"]] = relationship("User")