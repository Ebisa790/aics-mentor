import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    note_id = Column(UUID(as_uuid=True), ForeignKey("course_notes.id", ondelete="CASCADE"), nullable=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    exam_weight = Column(String(10), default="MEDIUM", nullable=False)  # HIGH, MEDIUM, LOW
    module_title = Column(String(255), nullable=True)
    status = Column(String(20), default="APPROVED", nullable=False)  # APPROVED, DRAFT
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
