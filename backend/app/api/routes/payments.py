import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.config import settings
from app.api.deps import get_current_user, require_admin
from app.models.user import User, UserRole, SubscriptionTier
from app.models.payment import Payment, PaymentStatus, PricingPlan
from app.schemas.payment import (
    PaymentInitResponse,
    PaymentVerifyResponse,
    PricingPlanResponse,
    PricingPlanCreate,
    PricingPlanUpdate,
)
from app.services.payment_service import PaymentService
from app.core.email import send_payment_confirmation_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])


# ------------------------------------------------------------------
# Request Schema
# ------------------------------------------------------------------
class PaymentInitRequest(BaseModel):
    plan_id: uuid.UUID = Field(..., description="ID of the pricing plan to purchase")


# ------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------
def get_or_create_default_plan(db: Session) -> PricingPlan:
    """Get active plan or create default 500 ETB lifetime plan."""
    plan = db.query(PricingPlan).filter(
        PricingPlan.is_active == True,
        PricingPlan.is_archived == False
    ).first()
    
    if not plan:
        plan = PricingPlan(
            name="Premium Lifetime",
            description="Full access to ExitAI Ethiopia - All courses, quizzes, mock exams, and AI features",
            amount=settings.DEFAULT_PREMIUM_PRICE,
            currency=settings.DEFAULT_PREMIUM_CURRENCY,
            duration_type="lifetime",
            features=[
                "Unlimited quizzes (no cooldown)",
                "100-question Exit Exam Simulator",
                "Full learning materials for all 16 CS courses",
                "AI explanations and personalized feedback",
                "Advanced analytics and readiness score",
                "Previous exam practice"
            ],
            is_active=True,
            is_archived=False
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
    
    return plan


def send_payment_email_notification(user: User, payment: Payment, plan: PricingPlan | None = None):
    """Send payment confirmation email to user."""
    try:
        plan_name = plan.name if plan else "Premium"
        send_payment_confirmation_email(
            to_email=user.email,
            full_name=user.full_name,
            amount=float(payment.amount),
            currency=payment.currency,
            plan_name=plan_name
        )
        logger.info(f"Payment confirmation email sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send payment confirmation email: {e}")


# ------------------------------------------------------------------
# 1. Public Endpoints
# ------------------------------------------------------------------
@router.get("/pricing", response_model=list[PricingPlanResponse])
def get_pricing_plans(db: Session = Depends(get_db)):
    """Get all active pricing plans (public endpoint)."""
    plans = (
        db.query(PricingPlan)
        .filter(PricingPlan.is_active == True, PricingPlan.is_archived == False)
        .order_by(PricingPlan.amount)
        .all()
    )
    
    if not plans:
        plan = get_or_create_default_plan(db)
        plans = [plan]
    
    return plans


# ------------------------------------------------------------------
# 2. Payment Endpoints
# ------------------------------------------------------------------
@router.post("/initialize", response_model=PaymentInitResponse)
@limiter.limit("5/minute")
async def initialize_payment(
    payload: PaymentInitRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initialize a new Chapa payment transaction."""
    service = PaymentService(db)
    
    try:
        payment = await service.initialize_payment(
            user=current_user,
            plan_id=payload.plan_id,
            return_url=f"{settings.FRONTEND_ORIGIN}/payment/callback?tx_ref={{tx_ref}}",
            callback_url=settings.CHAPA_CALLBACK_URL or str(request.url_for("chapa_webhook"))
        )
        
        return PaymentInitResponse(
            checkout_url=payment.checkout_url,
            tx_ref=payment.tx_ref,
            amount=float(payment.amount),
            currency=payment.currency
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Payment initialization error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service is temporarily unavailable. Please try again."
        )
    except Exception as e:
        logger.error(f"Unexpected payment error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again."
        )


@router.get("/verify/{tx_ref}", response_model=PaymentVerifyResponse)
@limiter.limit("10/minute")
async def verify_payment(
    request: Request,
    tx_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify payment status with Chapa and activate Premium if valid."""
    service = PaymentService(db)
    
    try:
        payment = await service.verify_payment(current_user, tx_ref)
        
        if payment.status == PaymentStatus.SUCCESS:
            # Get plan details for email
            plan = db.get(PricingPlan, payment.plan_id) if payment.plan_id else None
            
            # Send payment confirmation email
            send_payment_email_notification(current_user, payment, plan)
            
            return PaymentVerifyResponse(
                tx_ref=tx_ref,
                status=PaymentStatus.SUCCESS,
                message="Payment verified! Your Premium membership is active."
            )
        elif payment.status == PaymentStatus.PENDING:
            return PaymentVerifyResponse(
                tx_ref=tx_ref,
                status=PaymentStatus.PENDING,
                message="Payment is still pending. Please complete the payment or try again."
            )
        elif payment.status == PaymentStatus.CANCELLED:
            return PaymentVerifyResponse(
                tx_ref=tx_ref,
                status=PaymentStatus.CANCELLED,
                message="Payment was cancelled. You can try again anytime."
            )
        elif payment.status == PaymentStatus.EXPIRED:
            return PaymentVerifyResponse(
                tx_ref=tx_ref,
                status=PaymentStatus.EXPIRED,
                message="Payment session expired. Please start a new payment."
            )
        else:
            return PaymentVerifyResponse(
                tx_ref=tx_ref,
                status=PaymentStatus.FAILED,
                message="Payment verification failed. Please try again."
            )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Payment verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment verification service is temporarily unavailable."
        )


@router.api_route("/webhook", methods=["POST", "GET"], name="chapa_webhook")
async def chapa_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Chapa webhook endpoint for server-to-server notifications."""
    signature = (
        request.headers.get("x-chapa-signature") or
        request.headers.get("Chapa-Signature") or
        request.headers.get("X-Chapa-Signature", "")
    )
    
    body = await request.body()
    
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    service = PaymentService(db)
    
    try:
        result = await service.process_webhook(payload, signature, body)
        
        # If webhook processing was successful, send email notification
        if result.get("status") == "success" or result.get("message") == "Payment verified":
            # Extract tx_ref from payload
            tx_ref = payload.get("tx_ref") or payload.get("data", {}).get("tx_ref")
            if tx_ref:
                payment = db.query(Payment).filter(Payment.tx_ref == tx_ref).first()
                if payment and payment.status == PaymentStatus.SUCCESS:
                    user = db.get(User, payment.user_id)
                    plan = db.get(PricingPlan, payment.plan_id) if payment.plan_id else None
                    if user:
                        send_payment_email_notification(user, payment, plan)
        
        return result
    except ValueError as e:
        logger.warning(f"Webhook validation failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed"
        )


# ------------------------------------------------------------------
# 3. Admin Endpoints
# ------------------------------------------------------------------
@router.post("/pricing", response_model=PricingPlanResponse)
def create_pricing_plan(
    payload: PricingPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new pricing plan (Admin only)."""
    plan = PricingPlan(
        name=payload.name,
        description=payload.description,
        amount=payload.amount,
        currency=payload.currency,
        duration_type=payload.duration_type,
        duration_value=payload.duration_value,
        features=payload.features or [],
        is_active=payload.is_active
    )
    
    db.add(plan)
    db.commit()
    db.refresh(plan)
    
    logger.info(f"Admin {current_user.id} created plan {plan.id} at {plan.amount} {plan.currency}")
    
    return plan


@router.put("/pricing/{plan_id}", response_model=PricingPlanResponse)
def update_pricing_plan(
    plan_id: uuid.UUID,
    payload: PricingPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update an existing pricing plan (Admin only)."""
    plan = db.get(PricingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)
    
    plan.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plan)
    
    logger.info(f"Admin {current_user.id} updated plan {plan.id}")
    
    return plan


@router.delete("/pricing/{plan_id}")
def archive_pricing_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Archive a pricing plan (Admin only)."""
    plan = db.get(PricingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    plan.is_archived = True
    plan.is_active = False
    db.commit()
    
    logger.info(f"Admin {current_user.id} archived plan {plan.id}")
    
    return {"message": "Plan archived successfully"}


@router.get("/admin/stats")
def get_payment_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get payment statistics for admin dashboard."""
    total_payments = db.query(Payment).count()
    successful_payments = db.query(Payment).filter(Payment.status == PaymentStatus.SUCCESS).count()
    total_revenue = db.query(Payment).filter(Payment.status == PaymentStatus.SUCCESS).all()
    total_amount = sum(float(p.amount) for p in total_revenue)
    
    premium_users = db.query(User).filter(User.subscription_tier == SubscriptionTier.PREMIUM).count()
    
    return {
        "total_payments": total_payments,
        "successful_payments": successful_payments,
        "total_revenue": total_amount,
        "premium_users": premium_users,
        "conversion_rate": (successful_payments / total_payments * 100) if total_payments > 0 else 0
    }