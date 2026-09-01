"""
Support Ticket Model
Stores user support tickets and their status.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class TicketStatus(str, enum.Enum):
    """Status of a support ticket."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(str, enum.Enum):
    """Priority level of a support ticket."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Ticket details
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    issue_type = Column(String(50), nullable=False)  # account_reactivation, payment, technical, etc.
    
    # Status & Priority
    status = Column(Enum(TicketStatus), default=TicketStatus.OPEN, nullable=False)
    priority = Column(Enum(TicketPriority), default=TicketPriority.MEDIUM, nullable=False)
    
    # Admin response
    admin_response = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Who handled it
    handled_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    handled_by = relationship("User", foreign_keys=[handled_by_id])

    def __repr__(self):
        return f"<SupportTicket {self.id} - {self.status}>"
