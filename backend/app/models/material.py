import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, Enum, Boolean, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.course import Course, Topic
    from app.models.user import User


class MaterialSource(str, enum.Enum):
    ADMIN_OFFICIAL = "admin_official"  # Official Ministry / instructor material
    STUDENT_PERSONAL = "student_personal"  # Student's private uploaded notes


class MaterialStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"  # Text extraction & chunking in progress
    EMBEDDED = "embedded"  # Ready for RAG vector search
    FAILED = "failed"


class LearningMaterial(Base):
    """
    Stores study documents (PDFs, DOCX, TXT) uploaded by admins or students
    for curriculum access and vector embedding pipelines.
    """

    __tablename__ = "learning_materials"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("courses.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("topics.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # pdf, docx, txt
    source: Mapped[MaterialSource] = mapped_column(
        Enum(MaterialSource, name="material_source", values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    status: Mapped[MaterialStatus] = mapped_column(
        Enum(MaterialStatus, name="material_status", values_callable=lambda x: [e.value for e in x]),
        default=MaterialStatus.UPLOADED,
        nullable=False,
        index=True,
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )  # Admin materials visible to all students

    extracted_text_preview: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships mapped cleanly with User and Course definitions
    course = relationship("Course", back_populates="materials")
    topic: Mapped[Optional["Topic"]] = relationship("Topic", back_populates="materials")
    uploaded_by: Mapped["User"] = relationship("User", back_populates="materials")

    # Composite Index for filtering public ready-to-embed study materials
    __table_args__ = (
        Index("ix_learning_materials_status_public", "status", "is_public"),
    )