"""
Schemas for the manual bank-transfer payment flow.

Students send money to a bank account (CBE / Telebirr / Awash),
then submit the reference number. An admin verifies the deposit
in their bank app and approves or rejects.
"""
from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.payment import PaymentStatus


# ============================================================
# ENUMS
# ============================================================

class ManualBank(str, Enum):
    CBE = "cbe"
    TELEBIRR = "telebirr"
    AWASH = "awash"


# Per-bank reference patterns.
#
# IMPORTANT: These patterns are deliberately LOOSE first-pass validation.
# They only catch obvious typos and garbage. They do NOT prove a payment
# is real.
#
# Actual verification happens in two layers:
#   1. Format check (here) - the regex matches
#   2. Admin verification - a human matches the reference against the
#      actual bank statement before approving
#
# Because bank formats can drift, we prefer "too loose" over "too tight":
# a false rejection blocks a real student, whereas a false pass simply
# sends one more entry to the admin queue.
#
# Reference formats (from provider documentation / receipts, as of 2026):
#   CBE       - "FT" + alphanumeric (e.g. FT24ABC123XYZ). Length varies.
#   Telebirr  - 8-14 uppercase alphanumeric (e.g. 8E320N1XB4). We allow
#               up to 20 to be safe.
#   Awash     - alphanumeric with dashes, format varies by transaction type
#               (e.g. -2DBWYO2M4D-9UIFS).
BANK_REFERENCE_PATTERNS = {
    ManualBank.CBE: r"^FT[A-Z0-9]{6,20}$",
    ManualBank.TELEBIRR: r"^[A-Z0-9]{8,20}$",
    ManualBank.AWASH: r"^[A-Z0-9\-]{6,30}$",
}


# ============================================================
# BANK INFO (public - shown to students)
# ============================================================

class BankAccountInfo(BaseModel):
    """Single bank account shown on the payment page."""
    bank: ManualBank
    account_number: str
    account_name: str
    display_name: str  # e.g. "Commercial Bank of Ethiopia"


class ManualPaymentOptionsResponse(BaseModel):
    """List of available manual payment channels."""
    banks: list[BankAccountInfo]
    amount: float
    currency: str
    plan_id: UUID
    plan_name: str
    instructions: str
    # False when Chapa is in mock/test mode (MOCK_PAYMENT=true).
    # Frontend uses this to disable the Chapa button and nudge
    # students toward manual bank transfer until Chapa goes live.
    chapa_live: bool = False


# ============================================================
# INITIATE
# ============================================================

class ManualPaymentInitiateRequest(BaseModel):
    plan_id: UUID
    bank: ManualBank


class ManualPaymentInitiateResponse(BaseModel):
    """Returned after initiate - contains tx_ref and bank details."""
    tx_ref: str
    payment_id: UUID
    bank: ManualBank
    account_number: str
    account_name: str
    amount: float
    currency: str
    instructions: str


# ============================================================
# SUBMIT (student submits reference after paying)
# ============================================================

class ManualPaymentSubmitRequest(BaseModel):
    tx_ref: str = Field(..., min_length=4, max_length=100)
    bank_reference: str = Field(
        ...,
        min_length=6,
        max_length=255,
        description="The bank transaction reference / receipt number",
    )
    sender_name: Optional[str] = Field(None, max_length=255)
    sender_phone: Optional[str] = Field(None, max_length=20)
    student_note: Optional[str] = Field(None, max_length=1000)

    # Confirmation gates — the student must explicitly acknowledge
    # these before the backend will accept the submission.
    accepted_terms: bool = Field(
        ...,
        description="True if the student ticked both confirmation checkboxes.",
    )
    confirmed_amount: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="The amount the student typed, as a string (e.g. '500').",
    )

    @field_validator("bank_reference")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("sender_phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        # Remove spaces and dashes
        v = v.replace(" ", "").replace("-", "")
        # Ethiopian numbers: 09xxxxxxxx or 07xxxxxxxx or +251xxxxxxxxx
        if not v:
            return None
        if not (v.startswith("0") or v.startswith("+251")):
            raise ValueError("Phone must start with 0 or +251")
        if len(v) < 9 or len(v) > 15:
            raise ValueError("Phone length must be between 9 and 15 digits")
        return v


class ManualPaymentSubmitResponse(BaseModel):
    """Confirmation shown to student after submitting reference."""
    success: bool
    message: str
    payment_id: UUID
    tx_ref: str
    status: PaymentStatus


# ============================================================
# STATUS (student view)
# ============================================================

class ManualPaymentStatusItem(BaseModel):
    """One manual payment in the student's history."""
    payment_id: UUID
    tx_ref: str
    bank: ManualBank
    amount: float
    currency: str
    status: PaymentStatus
    bank_reference: str
    sender_name: Optional[str] = None
    created_at: datetime
    verified_at: Optional[datetime] = None
    admin_note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# ADMIN VIEWS
# ============================================================

class ManualPaymentAdminItem(BaseModel):
    """Full detail of a pending manual payment for admin review."""
    payment_id: UUID
    tx_ref: str
    user_id: UUID
    user_email: str
    user_full_name: Optional[str] = None
    plan_name: str
    amount: float
    currency: str
    status: PaymentStatus
    bank: ManualBank
    bank_reference: str
    sender_name: Optional[str] = None
    sender_phone: Optional[str] = None
    student_note: Optional[str] = None
    admin_note: Optional[str] = None
    created_at: datetime
    verified_at: Optional[datetime] = None


class ManualPaymentAdminListResponse(BaseModel):
    """Admin pending list with counts."""
    items: list[ManualPaymentAdminItem]
    total: int
    pending_count: int


class ManualPaymentApproveRequest(BaseModel):
    admin_note: Optional[str] = Field(None, max_length=1000)


class ManualPaymentRejectRequest(BaseModel):
    reason: str = Field("", max_length=1000)
    # One of the preset reason codes, or None if 'other'.
    # When provided, backend formats the stored note.
    reason_code: Optional[str] = Field(None, max_length=50)


class ManualPaymentActionResponse(BaseModel):
    success: bool
    message: str
    payment_id: UUID
    status: PaymentStatus