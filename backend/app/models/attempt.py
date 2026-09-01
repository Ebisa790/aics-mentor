import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional, List

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, Float, Boolean, Uuid, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.quiz import Quiz, Question


class DrillAttempt(Base):
    """
    Tracks individual code trace debugger drill attempts submitted by students.
    """
    __tablename__ = "drill_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    subject_slug: Mapped[str] = mapped_column(String, nullable=False)
    drill_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True, index=True
    )
    selected_option: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationship
    student: Mapped["User"] = relationship("User")


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"


class Attempt(Base):
    """
    Tracks a student's quiz or exam attempt along with overall scoring metadata.
    """

    __tablename__ = "attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    status: Mapped[AttemptStatus] = mapped_column(
        Enum(AttemptStatus, name="attempt_status"),
        default=AttemptStatus.IN_PROGRESS,
        nullable=False,
    )
    score_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    student: Mapped["User"] = relationship("User", back_populates="attempts")
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="attempts")
    answers: Mapped[List["AttemptAnswer"]] = relationship(
        "AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan"
    )

    # Composite Index for fetching a student's historical attempts on a specific quiz fast
    __table_args__ = (
        Index("ix_attempts_student_quiz", "student_id", "quiz_id"),
    )


class AttemptAnswer(Base):
    """
    Stores individual answers submitted by a student for a quiz question.
    """

    __tablename__ = "attempt_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    student_answer: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Relationships
    attempt: Mapped["Attempt"] = relationship("Attempt", back_populates="answers")
    question: Mapped["Question"] = relationship("Question")