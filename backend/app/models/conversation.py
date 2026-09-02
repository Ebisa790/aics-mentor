from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List

from sqlalchemy import String, Text, DateTime, ForeignKey, Enum, Uuid, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class TutorMode(str, enum.Enum):
    BEGINNER = "beginner"
    ADVANCED = "advanced"
    EXPLANATION = "explanation"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class AIConversation(Base):
    """
    Tracks AI conversation threads per student and course to maintain scoped context.
    """

    __tablename__ = "ai_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("courses.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), default="New conversation", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        server_default=func.now(), 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    student: Mapped["User"] = relationship("User", back_populates="conversations")
    course: Mapped[Optional["Course"]] = relationship("Course")
    messages: Mapped[List["AIMessage"]] = relationship(
        "AIMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AIMessage.created_at",
    )


class AIMessage(Base):
    """
    Stores individual prompt and response exchanges within an AI thread.
    """

    __tablename__ = "ai_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role", values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[TutorMode | None] = mapped_column(
        Enum(TutorMode, name="tutor_mode", values_callable=lambda x: [e.value for e in x]), nullable=True
    )

    # Tag extracted post-hoc for student weakness analysis & mastery tracking
    flagged_topic: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    conversation: Mapped["AIConversation"] = relationship("AIConversation", back_populates="messages")

    # Composite Index for rapid thread history ordering
    __table_args__ = (
        Index("ix_ai_messages_conversation_created", "conversation_id", "created_at"),
    )