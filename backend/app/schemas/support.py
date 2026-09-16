"""Schemas for support tickets."""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from enum import Enum


class SupportIssueType(str, Enum):
    PAYMENT = "payment"
    REFUND = "refund"
    ACCOUNT_REACTIVATION = "account_reactivation"
    ACCOUNT_ISSUES = "account_issues"
    TECHNICAL = "technical"
    CONTENT = "content"
    FEEDBACK = "feedback"
    OTHER = "other"


class SupportTicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=20, max_length=5000)
    issue_type: SupportIssueType = SupportIssueType.OTHER
    # Only required for anonymous submissions — ignored when authenticated
    email: Optional[EmailStr] = None