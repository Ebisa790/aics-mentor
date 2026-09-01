from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.payment import PaymentStatus, PlanDurationType


class PaymentInitResponse(BaseModel):
    checkout_url: str
    tx_ref: str
    amount: float
    currency: str


class PaymentVerifyResponse(BaseModel):
    tx_ref: str
    status: PaymentStatus
    message: str

    model_config = ConfigDict(from_attributes=True)


class PricingPlanCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    amount: float = Field(..., gt=0, description="Price (e.g., 500.00)")
    currency: str = Field("ETB", max_length=10)
    duration_type: PlanDurationType = PlanDurationType.LIFETIME
    duration_value: Optional[int] = Field(None, ge=1)
    features: List[str] = Field(default_factory=list)
    is_active: bool = True


class PricingPlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = Field(None, max_length=10)
    duration_type: Optional[PlanDurationType] = None
    duration_value: Optional[int] = Field(None, ge=1)
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None


class PricingPlanResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    amount: float
    currency: str
    duration_type: PlanDurationType
    duration_value: Optional[int] = None
    features: List[str] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)