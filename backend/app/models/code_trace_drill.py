import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CodeTraceDrill(Base):
    __tablename__ = "code_trace_drills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject = Column(String(50), nullable=False)  # "cpp-programming", "oop", "dsa-trace"
    topic = Column(String(200), nullable=False)
    code_snippet = Column(Text, nullable=False)
    language = Column(String(10), default="cpp")
    total_steps = Column(Integer, nullable=False)
    trace_steps = Column(JSON, nullable=False)
    exit_exam_question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)
    correct_option_index = Column(Integer, nullable=False)
    distractor_explanation = Column(Text, nullable=False)
    difficulty = Column(String(10), default="medium")  # easy/medium/hard
    priority = Column(String(10), default="HIGH")  # HIGH/MEDIUM/LOW
    status = Column(String(20), default="DRAFT")  # DRAFT/APPROVED/REJECTED/ARCHIVED
    source_type = Column(String(20), default="ai_generated")  # ai_generated/manual_paste/external_ai
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
