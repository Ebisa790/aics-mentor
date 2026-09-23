"""
Exam Blueprint — the official MoE Exit Exam structure.

Stores the courses, themes, weights, and cognitive-level distribution
from the Ministry of Education's official Test Blueprint.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ExamBlueprintItem(Base):
    """
    A single course entry in the MoE Exit Exam blueprint.

    Example: Operating System — Theme: Computer Architecture &
    Operating Systems, 6 items, cognitive distribution applies.
    """
    __tablename__ = "exam_blueprint_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Theme grouping (e.g., "Programming and Algorithms")
    theme: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Course name (e.g., "Operating System")
    course_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Credit hours from MoE curriculum
    credit_hours: Mapped[int] = mapped_column(Integer, nullable=False)

    # Number of exam items from this course (out of 100 total)
    test_items: Mapped[int] = mapped_column(Integer, nullable=False)

    # Cognitive distribution (Bloom's Taxonomy) — count of items at each level
    cognitive_remember: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cognitive_understand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cognitive_apply: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cognitive_analyze: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cognitive_evaluate: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cognitive_create: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Optional: link to the actual course in our platform (for practice links)
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )

    # Ordering for display
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )