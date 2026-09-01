import enum
import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Column, DateTime, func
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum, Boolean, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class ExamDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ReviewStatus(str, enum.Enum):
    """
    QA workflow states. Human-authored questions are created directly in APPROVED state,
    while AI drafts progress through GENERATED -> UNDER_REVIEW -> APPROVED / REJECTED.
    """
    GENERATED = "generated"      # Fresh AI draft, awaiting human review
    UNDER_REVIEW = "under_review"# Admin is currently inspecting or editing
    APPROVED = "approved"        # Promoted into active student question bank
    REJECTED = "rejected"        # Rejected during QA review
    ARCHIVED = "archived"        # Retired from active use


class ExamQuestion(Base):
    """
    QA staging table for multiple-choice questions (MCQs) before promotion to active student banks.
    """

    __tablename__ = "exam_questions"

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
        index=True,
        nullable=True,
    )

    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(Text, nullable=False)
    option_b: Mapped[str] = mapped_column(Text, nullable=False)
    option_c: Mapped[str] = mapped_column(Text, nullable=False)
    option_d: Mapped[str] = mapped_column(Text, nullable=False)
    correct_option: Mapped[str] = mapped_column(String(1), nullable=False)  # 'A' | 'B' | 'C' | 'D'
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[ExamDifficulty] = mapped_column(
        Enum(ExamDifficulty, name="exam_difficulty"),
        default=ExamDifficulty.MEDIUM,
        nullable=False,
    )
    is_ai_generated: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    # --- QA workflow & Audit Trail ---
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="review_status"),
        default=ReviewStatus.APPROVED,
        nullable=False,
        index=True,
    )
    ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "llama-3.1-8b-instant"
    ai_topic: Mapped[str | None] = mapped_column(String(300), nullable=True)  # Generation prompt/topic context
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    promoted_question_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
    )
    

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships using string forward references to prevent circular imports
    course: Mapped["Course"] = relationship("Course", back_populates="exam_questions")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])
    reviewed_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by_id])

    # Composite Index for rapid QA queue filtering
    __table_args__ = (
        Index("ix_exam_questions_status_course", "review_status", "course_id"),
    )



class ExamQuestionResponse(BaseModel):
    id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str
    difficulty: str
    review_status: str
    is_ai_generated: bool = False
    ai_topic: Optional[str] = None
    course_id: str

    model_config = ConfigDict(from_attributes=True)