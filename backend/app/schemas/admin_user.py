import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.user import UserRole, SubscriptionTier


class AdminUserOut(BaseModel):
    """
    Schema for user representation in the administrative management dashboard.
    """
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    subscription_tier: SubscriptionTier
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserUpdate(BaseModel):
    """
    Schema for administrative updates to a user's role, subscription tier, or active status.
    """
    role: Optional[UserRole] = Field(
        None, description="Updated role privilege level (student or admin)"
    )
    subscription_tier: Optional[SubscriptionTier] = Field(
        None, description="Updated platform subscription tier (free or premium)"
    )
    is_active: Optional[bool] = Field(
        None, description="Account active status flag for enabling or disabling access"
    )

    model_config = ConfigDict(from_attributes=True)