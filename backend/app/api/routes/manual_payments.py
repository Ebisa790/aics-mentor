"""
Manual bank-transfer payment routes.

These live under /api/payments/manual/* and are completely separate
from the Chapa routes (/api/payments/*). They share the payments table
but use payment_method='manual_<bank>' so the two flows never collide.
"""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.config import settings
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.payment import Payment, PaymentStatus, PricingPlan
from app.services.manual_payment_service import (
    ManualPaymentService,
    ManualPaymentError,
    BANK_DISPLAY_NAMES,
)
from app.schemas.manual_payment import (
    ManualBank,
    BankAccountInfo,
    ManualPaymentOptionsResponse,
    ManualPaymentInitiateRequest,
    ManualPaymentInitiateResponse,
    ManualPaymentSubmitRequest,
    ManualPaymentSubmitResponse,
    ManualPaymentStatusItem,
    ManualPaymentAdminItem,
    ManualPaymentAdminListResponse,
    ManualPaymentApproveRequest,
    ManualPaymentRejectRequest,
    ManualPaymentActionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments/manual", tags=["manual-payments"])


# ============================================================
# HELPERS
# ============================================================

INSTRUCTIONS_TEMPLATE = (
    "Send exactly {amount} {currency} to the account shown below, using "
    "your own bank app or by visiting a branch. Then come back here and "
    "submit the transaction reference number. Admin will verify within "
    "24 hours."
)


def _get_default_plan(db: Session) -> Optional[PricingPlan]:
    """Return the active pricing plan (there should be one)."""
    return (
        db.query(PricingPlan)
        .filter(PricingPlan.is_active == True, PricingPlan.is_archived == False)
        .order_by(PricingPlan.amount)
        .first()
    )


# ============================================================
# PUBLIC — available banks + amount
# ============================================================

@router.get("/options", response_model=ManualPaymentOptionsResponse)
@limiter.limit("30/minute")
def get_manual_options(request: Request, db: Session = Depends(get_db)):
    """
    Public: list available manual payment channels and the active amount.
    Frontend calls this to render the "Pay via Bank" section.
    """
    service = ManualPaymentService(db)
    banks: list[BankAccountInfo] = service.get_available_banks()

    plan = _get_default_plan(db)
    if not plan:
        # No active plan — return empty banks, frontend hides the option
        return ManualPaymentOptionsResponse(
            banks=[],
            amount=0.0,
            currency="ETB",
            plan_id=uuid.UUID(int=0),
            plan_name="",
            instructions="Manual payment is currently unavailable.",
            chapa_live=not settings.MOCK_PAYMENT,
        )

    instructions = INSTRUCTIONS_TEMPLATE.format(
        amount=float(plan.amount),
        currency=plan.currency,
    )

    return ManualPaymentOptionsResponse(
        banks=banks,
        amount=float(plan.amount),
        currency=plan.currency,
        plan_id=plan.id,
        plan_name=plan.name,
        instructions=instructions,
        chapa_live=not settings.MOCK_PAYMENT,
    )


# ============================================================
# USER — initiate
# ============================================================

@router.post("/initiate", response_model=ManualPaymentInitiateResponse)
@limiter.limit("3/hour;10/day")
def initiate_manual_payment(
    request: Request,
    payload: ManualPaymentInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a pending manual payment and return the bank details."""
    service = ManualPaymentService(db)

    try:
        payment = service.initiate(
            user=current_user,
            plan_id=payload.plan_id,
            bank=payload.bank,
        )
    except ManualPaymentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Manual initiate failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not start manual payment. Please try again.",
        )

    # Fetch the account details for the chosen bank
    accounts = service._bank_accounts()  # {bank: (acct, name)}
    acct, name = accounts[payload.bank]

    instructions = INSTRUCTIONS_TEMPLATE.format(
        amount=float(payment.amount),
        currency=payment.currency,
    )

    return ManualPaymentInitiateResponse(
        tx_ref=payment.tx_ref,
        payment_id=payment.id,
        bank=payload.bank,
        account_number=acct,
        account_name=name,
        amount=float(payment.amount),
        currency=payment.currency,
        instructions=instructions,
    )


# ============================================================
# USER — submit reference
# ============================================================

@router.post("/submit", response_model=ManualPaymentSubmitResponse)
@limiter.limit("5/hour;15/day")
def submit_manual_payment(
    request: Request,
    payload: ManualPaymentSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student submits the bank reference after paying."""
    service = ManualPaymentService(db)

    try:
        payment = service.submit_reference(
            user=current_user,
            tx_ref=payload.tx_ref,
            bank_reference=payload.bank_reference,
            sender_name=payload.sender_name,
            sender_phone=payload.sender_phone,
            student_note=payload.student_note,
        )
    except ManualPaymentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Manual submit failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not submit payment. Please try again.",
        )

    return ManualPaymentSubmitResponse(
        success=True,
        message="We received your reference. Admin will verify within 24 hours.",
        payment_id=payment.id,
        tx_ref=payment.tx_ref,
        status=payment.status,
    )


# ============================================================
# USER — list my manual payments
# ============================================================

@router.get("/mine", response_model=list[ManualPaymentStatusItem])
@limiter.limit("30/minute")
def list_my_manual_payments(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student's manual payment history + current status."""
    service = ManualPaymentService(db)
    rows = service.list_user_manual_payments(current_user)

    return [
        ManualPaymentStatusItem(
            payment_id=r["payment_id"],
            tx_ref=r["tx_ref"],
            bank=ManualBank(r["bank"]),
            amount=r["amount"],
            currency=r["currency"],
            status=r["status"],
            bank_reference=r["bank_reference"],
            sender_name=r["sender_name"],
            created_at=r["created_at"],
            verified_at=r["verified_at"],
            admin_note=r["admin_note"],
        )
        for r in rows
    ]


# ============================================================
# ADMIN — list pending
# ============================================================

@router.get("/admin/pending", response_model=ManualPaymentAdminListResponse)
@limiter.limit("60/minute")
def list_pending_manual(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin: list all pending manual payments awaiting verification."""
    service = ManualPaymentService(db)
    rows = service.list_pending_for_admin()

    items = [
        ManualPaymentAdminItem(
            payment_id=r["payment_id"],
            tx_ref=r["tx_ref"],
            user_id=r["user_id"],
            user_email=r["user_email"],
            user_full_name=r["user_full_name"],
            plan_name=r["plan_name"],
            amount=r["amount"],
            currency=r["currency"],
            status=r["status"],
            bank=ManualBank(r["bank"]),
            bank_reference=r["bank_reference"],
            sender_name=r["sender_name"],
            sender_phone=r["sender_phone"],
            student_note=r["student_note"],
            admin_note=r["admin_note"],
            created_at=r["created_at"],
            verified_at=r["verified_at"],
        )
        for r in rows
    ]

    return ManualPaymentAdminListResponse(
        items=items,
        total=len(items),
        pending_count=len(items),
    )


# ============================================================
# ADMIN — approve
# ============================================================

@router.post("/admin/{payment_id}/approve", response_model=ManualPaymentActionResponse)
@limiter.limit("30/minute")
def approve_manual_payment(
    payment_id: uuid.UUID,
    payload: ManualPaymentApproveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin approves a manual payment → activates Premium for the user."""
    service = ManualPaymentService(db)

    try:
        payment = service.approve(
            payment_id=payment_id,
            admin_note=payload.admin_note,
        )
    except ManualPaymentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Manual approve failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not approve payment. Please try again.",
        )

    logger.info(f"Admin {current_user.id} approved manual payment {payment.id}")

    return ManualPaymentActionResponse(
        success=True,
        message="Payment approved. Premium activated for the student.",
        payment_id=payment.id,
        status=payment.status,
    )


# ============================================================
# ADMIN — reject
# ============================================================

@router.post("/admin/{payment_id}/reject", response_model=ManualPaymentActionResponse)
@limiter.limit("30/minute")
def reject_manual_payment(
    payment_id: uuid.UUID,
    payload: ManualPaymentRejectRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin rejects a manual payment with a reason."""
    service = ManualPaymentService(db)

    try:
        payment = service.reject(
            payment_id=payment_id,
            reason=payload.reason,
        )
    except ManualPaymentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Manual reject failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not reject payment. Please try again.",
        )

    logger.info(f"Admin {current_user.id} rejected manual payment {payment.id}")

    return ManualPaymentActionResponse(
        success=True,
        message="Payment rejected.",
        payment_id=payment.id,
        status=payment.status,
    )