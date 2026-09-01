import enum
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Numeric, Enum, ForeignKey, DateTime, Boolean, func, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class PlanDurationType(str, enum.Enum):
    LIFETIME = "lifetime"
    MONTHLY = "monthly"
    SEMESTER = "semester"
    ANNUAL = "annual"
    CUSTOM = "custom"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


class PricingPlan(Base):
    """
    Admin-managed pricing plans.
    Supports dynamic pricing (e.g., 200, 300, 500, or 1000 ETB).
    """
    __tablename__ = "pricing_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), default="Lifetime Premium", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    amount: Mapped[float] = mapped_column(Numeric(10, 2), default=500.00, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="ETB", nullable=False)
    
    duration_type: Mapped[PlanDurationType] = mapped_column(
        Enum(PlanDurationType, name="plan_duration_type", values_callable=lambda x: [e.value for e in x]),
        default=PlanDurationType.LIFETIME,
        nullable=False
    )
    duration_value: Mapped[Optional[int]] = mapped_column(
        nullable=True,
        comment="Number of duration units. NULL for lifetime."
    )
    
    features: Mapped[list] = mapped_column(
        JSON, 
        nullable=False, 
        default=list,
        comment="List of features included in this plan"
    )
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    
    # Relationships
    payments = relationship("Payment", back_populates="plan")
    subscriptions = relationship("Subscription", back_populates="plan")


class Payment(Base):
    """
    Dedicated table tracking every Chapa transaction attempt and status.
    """
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pricing_plans.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    
    tx_ref: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    chapa_transaction_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True)
    
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="ETB", nullable=False)
    
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(
            PaymentStatus,
            name="payment_status",
            values_callable=lambda x: [e.value for e in x]
        ),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True
    )
    
    checkout_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", backref="payments")
    plan: Mapped["PricingPlan"] = relationship("PricingPlan", back_populates="payments")
    subscription: Mapped[Optional["Subscription"]] = relationship(
        "Subscription", back_populates="payment", uselist=False, cascade="all, delete-orphan"
    )


class Subscription(Base):
    """
    Tracks user subscriptions with expiry support.
    For lifetime: expires_at is NULL.
    """
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pricing_plans.id", ondelete="RESTRICT"), nullable=False
    )
    
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status", values_callable=lambda x: [e.value for e in x]),
        default=SubscriptionStatus.ACTIVE,
        nullable=False,
        index=True
    )
    
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), 
        nullable=True,
        comment="NULL for lifetime subscriptions"
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

     # Relationships
    user: Mapped["User"] = relationship("User")
    plan: Mapped["PricingPlan"] = relationship("PricingPlan", back_populates="subscriptions")
    payment: Mapped["Payment"] = relationship("Payment", back_populates="subscription")
