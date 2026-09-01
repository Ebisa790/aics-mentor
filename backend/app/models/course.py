import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import String, Column, Text, DateTime, ForeignKey, Integer, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.material import LearningMaterial
    from app.models.course_material import CourseMaterial
    from app.models.exam_question import ExamQuestion
    from app.models.quiz import Question


class CourseNotes(Base):
    __tablename__ = "course_notes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    source_type = Column(String(50), nullable=False)  # "uploaded_materials" or "exit_exam_standard"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # NEW FIELDS FOR REVIEW WORKFLOW
    version = Column(Integer, default=1, nullable=False)
    status = Column(String(20), default="DRAFT", nullable=False)  # DRAFT, APPROVED, REJECTED, ARCHIVED
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    coverage_score = Column(Integer, nullable=True)  # 0-100
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to Course
    course: Mapped["Course"] = relationship("Course", backref="notes_list")


class Course(Base):
    """
    Top-level subject area corresponding to MoE exit exam competencies 
    (e.g., 'Operating Systems', 'Data Structures & Algorithms').
    """

    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    code: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True
    )  # Official MoE course code, e.g. "CoSc2092"
    category: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )  # Exam theme category
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ects_credits: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    department: Mapped["Department"] = relationship("Department", back_populates="courses")
    topics: Mapped[List["Topic"]] = relationship(
        "Topic", back_populates="course", cascade="all, delete-orphan", order_by="Topic.order_index"
    )
    
    materials: Mapped[List["LearningMaterial"]] = relationship(
        "LearningMaterial", back_populates="course", cascade="all, delete-orphan"
    )
    study_materials: Mapped[List["CourseMaterial"]] = relationship(
        "CourseMaterial", back_populates="course", cascade="all, delete-orphan"
    )
    exam_questions: Mapped[List["ExamQuestion"]] = relationship(
        "ExamQuestion", back_populates="course", cascade="all, delete-orphan"
    )
    
    questions: Mapped[List["Question"]] = relationship(
        "Question", back_populates="course", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_courses_dept_order", "department_id", "order_index"),
    )


class Topic(Base):
    """
    Subtopic domain within a course (e.g., 'Process Synchronization & Deadlocks' within 'Operating Systems').
    """

    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="topics")
    materials: Mapped[List["LearningMaterial"]] = relationship("LearningMaterial", back_populates="topic")
    
    questions: Mapped[List["Question"]] = relationship(
        "Question", back_populates="topic", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_topics_course_order", "course_id", "order_index"),
    )