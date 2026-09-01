import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List, Dict, Any

from sqlalchemy import String, Text, DateTime, ForeignKey, Enum, Integer, JSON, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.course import Course, Topic
    from app.models.user import User
    from app.models.attempt import Attempt


class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    SHORT_ANSWER = "short_answer"


class DifficultyLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"



class Question(Base):
    """
    Individual assessment question bank item (curated or generated).
    """

    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("topics.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    question_type: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType, name="question_type"), nullable=False
    )
    difficulty: Mapped[DifficultyLevel] = mapped_column(
        Enum(DifficultyLevel, name="difficulty_level"),
        default=DifficultyLevel.INTERMEDIATE,
        nullable=False,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)

    # For MULTIPLE_CHOICE: {"A": "...", "B": "...", "C": "...", "D": "..."}
    choices: Mapped[Dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)  # Choice key or short-answer text
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships using string forward references
    course: Mapped["Course"] = relationship("Course", back_populates="questions")
    topic: Mapped[Optional["Topic"]] = relationship("Topic", back_populates="questions")

    __table_args__ = (
        Index("ix_questions_course_difficulty", "course_id", "difficulty"),
    )


class QuizType(str, enum.Enum):
    DAILY_QUIZ = "daily_quiz"
    CHAPTER_TEST = "chapter_test"
    WEEKLY_EXAM = "weekly_exam"
    FULL_SIMULATION = "full_simulation"


class GeneratedExamMode(str, enum.Enum):
    """
    Set only on quizzes created by the random-generation engine (POST /api/exams/generate).
    Null for admin-curated quizzes.
    """
    PRACTICE = "practice"  # Free tier: 10 questions, untimed, AI feedback
    MOCK = "mock"          # Premium tier: 100 questions, 120-minute timer


class Quiz(Base):
    """
    A collection of questions grouped into a test, daily quiz, or exam simulation.
    """

    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("courses.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    quiz_type: Mapped[QuizType] = mapped_column(
        Enum(QuizType, name="quiz_type"),
        default=QuizType.DAILY_QUIZ,
        nullable=False,
    )
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True) 
    generated_mode: Mapped[GeneratedExamMode | None] = mapped_column(
        Enum(GeneratedExamMode, name="generated_exam_mode"), nullable=True
    )
    generated_for_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    quiz_questions: Mapped[List["QuizQuestion"]] = relationship(
        "QuizQuestion",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.order_index",
    )
    attempts: Mapped[List["Attempt"]] = relationship("Attempt", back_populates="quiz")


class QuizQuestion(Base):
    """
    Association table linking questions to quizzes with explicit order indices.
    """

    __tablename__ = "quiz_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="quiz_questions")
    question: Mapped["Question"] = relationship("Question")

    __table_args__ = (
        Index("ix_quiz_questions_quiz_order", "quiz_id", "order_index"),
    )