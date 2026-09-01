import re
import uuid
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

from app.models.user import UserRole, SubscriptionTier

class GoogleLoginRequest(BaseModel):
    id_token: str

def _validate_password_strength(password: str) -> str:
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("Password must contain at least one letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    return password


class UserRegister(BaseModel):
    email: EmailStr = Field(..., description="Unique email address for authentication")
    password: str = Field(min_length=8, description="User password meeting complexity requirements")
    full_name: str = Field(min_length=2, max_length=255, description="User full name")
    university: str | None = Field(None, description="Enrolled university or institution name")
    year_of_study: int | None = Field(None, ge=1, le=7, description="Current academic year level")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="Registered account email")
    password: str = Field(..., description="Account password")


class Token(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field("bearer", description="Token authorization type")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address associated with the account")


class ForgotPasswordResponse(BaseModel):
    message: str = Field(..., description="Status message regarding reset instructions")
    dev_reset_token: str | None = Field(None, description="Dev token if SMTP is inactive")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset token")
    new_password: str = Field(min_length=8, description="New account password")

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    university: str | None = Field(None, max_length=255)
    year_of_study: int | None = Field(None, ge=1, le=7)
    exam_date: date | None = Field(None, description="Target exit exam date")
    available_weekly_hours: int | None = Field(None, ge=1, le=168, description="Study hours per week capacity")


class DeviceResponse(BaseModel):
    id: str
    device_name: str
    device_type: str
    browser: str
    ip_address: str
    last_active: str
    is_current_device: bool

    model_config = ConfigDict(from_attributes=True)


class RevokeDeviceResponse(BaseModel):
    message: str
    revoked_device_id: str


class RevokeOthersResponse(BaseModel):
    message: str
    revoked_count: int


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_2fa_enabled: bool = False
    full_name: str
    role: UserRole
    university: str | None
    year_of_study: int | None
    exam_date: date | None
    available_weekly_hours: int | None
    learning_speed: str | None
    strengths_summary: str | None
    weaknesses_summary: str | None
    subscription_tier: SubscriptionTier
    ai_usage_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)