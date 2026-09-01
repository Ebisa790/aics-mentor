import enum
import uuid
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, date, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Column, ForeignKey, String, Boolean, DateTime, Enum, Text, Integer, Date, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.material import LearningMaterial
    from app.models.attempt import Attempt
    from app.models.conversation import AIConversation
   


class UserRole(str, enum.Enum):
    STUDENT = "student"
    ADMIN = "admin"


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PREMIUM = "premium"

class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_jti = Column(String(255), unique=True, nullable=False, index=True) # JWT unique identifier
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(20), nullable=False, default="unknown") # 'desktop' | 'mobile' | 'tablet' | 'unknown'
    browser = Column(String(100), nullable=False)
    ip_address = Column(String(45), nullable=False)
    last_active = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    is_revoked = Column(Boolean, default=False, nullable=False)
    is_trusted = Column(Boolean, default=False, nullable=False)
    trusted_until = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="devices")

class User(Base):
    """
    Core user model managing authentication credentials, 2FA security, 
    monetization subscription tiers, and personalized AI study coach memory.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), 
        default=UserRole.STUDENT, 
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # 2FA Security fields
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email_2fa_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    email_2fa_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_2fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # AI memory / student profile data for coaching personalization
    university: Mapped[str | None] = mapped_column(String(255), nullable=True)
    year_of_study: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    available_weekly_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    learning_speed: Mapped[str | None] = mapped_column(String(32), nullable=True)
    strengths_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    weaknesses_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Subscription & Usage Limits
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier, name="subscription_tier"), 
        default=SubscriptionTier.FREE, 
        nullable=False,
        index=True,
    )
    ai_usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_ai_usage_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
   
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_active = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    materials: Mapped[List["LearningMaterial"]] = relationship(
    "LearningMaterial", back_populates="uploaded_by", cascade="all, delete-orphan"
)
    attempts: Mapped[List["Attempt"]] = relationship(
        "Attempt", back_populates="student", cascade="all, delete-orphan"
    )
    conversations: Mapped[List["AIConversation"]] = relationship(
        "AIConversation", back_populates="student", cascade="all, delete-orphan"
    )

    devices: Mapped[list["UserDevice"]] = relationship(
        "UserDevice", 
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    # Add this to the User model after the devices relationship:

    subscription_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), 
        nullable=True,
        comment="When current premium subscription expires. NULL for lifetime."
    )

# Add this relationship (after devices relationship):
    # Subscription relationship is defined in app.models.payment.Subscription
    # using back_populates="user" to avoid circular import
    failed_login_attempts = Column(Integer, default=0, nullable=True)
    locked_until = Column(DateTime(timezone=True), nullable=True)