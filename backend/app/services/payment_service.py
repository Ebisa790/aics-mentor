"""
Payment service layer for Chapa integration.
Handles business logic separate from HTTP routes.
"""
import hmac
import hashlib
import uuid
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
import httpx

from app.core.config import settings
from app.core.email import send_payment_confirmation_email
from app.models.payment import (
    Payment, 
    PaymentStatus, 
    PricingPlan, 
    Subscription, 
    SubscriptionStatus,
    PlanDurationType
)
from app.models.user import User, SubscriptionTier

logger = logging.getLogger(__name__)


def sanitize_chapa_description(description: str) -> str:
    """
    Sanitize description for Chapa API.
    Rules:
    - Max 50 characters
    - Only letters, numbers, hyphens, underscores, spaces, and dots
    """
    if not description:
        return "Premium Subscription"
    
    # Remove invalid characters (keep letters, numbers, hyphens, underscores, spaces, dots)
    cleaned = re.sub(r'[^a-zA-Z0-9\s._-]', '', description)
    
    # Remove extra spaces
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # Truncate to 50 characters
    if len(cleaned) > 50:
        cleaned = cleaned[:47] + "..."
    
    # If empty after cleaning, use default
    if not cleaned:
        cleaned = "Premium Subscription"
    
    return cleaned


class ChapaClient:
    """HTTP client for Chapa API."""
    
    def __init__(self, db: Optional[Session] = None):
        self.base_url = settings.CHAPA_API_URL.rstrip('/')
        self.secret_key = settings.CHAPA_SECRET_KEY
        self.db = db
        self.headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json"
        }
    
    async def initialize_transaction(self, payload: dict) -> dict:
        """Initialize a payment transaction with Chapa."""
        if settings.MOCK_PAYMENT:
            return {
                "status": "success",
                "message": "Hosted Link Generated",
                "data": {
                    "checkout_url": f"http://localhost:5173/payment/callback?tx_ref={payload['tx_ref']}"
                }
            }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/transaction/initialize",
                json=payload,
                headers=self.headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    async def verify_transaction(self, tx_ref: str) -> dict:
        """Verify a transaction with Chapa API."""
        if settings.MOCK_PAYMENT:
            # Get the actual payment amount from database - NO HARDCODING
            amount = None
            currency = "ETB"
            
            if self.db:
                payment = self.db.query(Payment).filter(Payment.tx_ref == tx_ref).first()
                if payment:
                    amount = str(float(payment.amount))
                    currency = payment.currency
                    logger.info(f"Mock verification using actual payment amount: {amount} {currency}")
            
            # If no payment found, log warning and use a safe default
            if amount is None:
                logger.warning(f"No payment record found for tx_ref={tx_ref} in mock mode")
                amount = "0.00"
            
            return {
                "status": "success",
                "message": "Transaction verified",
                "data": {
                    "status": "success",
                    "tx_ref": tx_ref,
                    "amount": amount,
                    "currency": currency,
                    "reference": f"mock_{tx_ref}"
                }
            }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/transaction/verify/{tx_ref}",
                headers=self.headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()


class PaymentService:
    """Business logic for payment processing."""
    
    def __init__(self, db: Session):
        self.db = db
        self.chapa_client = ChapaClient(db)
    
    def generate_tx_ref(self, user_id: uuid.UUID) -> str:
        """Generate a unique transaction reference."""
        return f"EXITAI-{user_id.hex[:8]}-{uuid.uuid4().hex}"
    
    def get_active_plans(self) -> list[PricingPlan]:
        """Get all active (non-archived) pricing plans."""
        return (
            self.db.query(PricingPlan)
            .filter(PricingPlan.is_active == True, PricingPlan.is_archived == False)
            .order_by(PricingPlan.amount)
            .all()
        )
    
    def get_plan_by_id(self, plan_id: uuid.UUID) -> Optional[PricingPlan]:
        """Get a specific plan by ID."""
        return self.db.get(PricingPlan, plan_id)
    
    def calculate_expiry_date(self, plan: PricingPlan) -> Optional[datetime]:
        """Calculate subscription expiry based on plan duration."""
        if plan.duration_type == PlanDurationType.LIFETIME:
            return None
        
        now = datetime.now(timezone.utc)
        
        if plan.duration_type == PlanDurationType.MONTHLY:
            return now + timedelta(days=30 * (plan.duration_value or 1))
        elif plan.duration_type == PlanDurationType.SEMESTER:
            return now + timedelta(days=180 * (plan.duration_value or 1))
        elif plan.duration_type == PlanDurationType.ANNUAL:
            return now + timedelta(days=365 * (plan.duration_value or 1))
        elif plan.duration_type == PlanDurationType.CUSTOM:
            return now + timedelta(days=plan.duration_value or 30)
        
        return None
    
    async def initialize_payment(
        self, 
        user: User, 
        plan_id: uuid.UUID,
        return_url: Optional[str] = None,
        callback_url: Optional[str] = None
    ) -> Payment:
        """Initialize a new payment transaction."""
        
        # Check if user already has active premium
        if self._has_active_premium(user):
            raise ValueError("User already has active Premium subscription")
        
        # Get plan - amount comes from database (dynamic pricing)
        plan = self.get_plan_by_id(plan_id)
        if not plan or not plan.is_active or plan.is_archived:
            raise ValueError("Invalid or inactive pricing plan")
        
        # Generate unique tx_ref
        tx_ref = self.generate_tx_ref(user.id)
        
        # Build URLs
        frontend_return_url = "http://localhost:5173/payment/callback?tx_ref=" + tx_ref
        backend_callback_url = callback_url or settings.CHAPA_CALLBACK_URL
        
        # Prepare Chapa payload
        names = (user.full_name or "Student User").split()
        first_name = names[0]
        last_name = names[-1] if len(names) > 1 else "User"
        
        # Sanitize description for Chapa (max 50 chars, valid characters only)
        chapa_description = sanitize_chapa_description(plan.description)
        
        # Use plan.amount from database - DYNAMIC PRICING
        chapa_payload = {
            "amount": str(float(plan.amount)),
            "currency": plan.currency,
            "email": user.email,
            "first_name": first_name,
            "last_name": last_name,
            "tx_ref": tx_ref,
            "callback_url": backend_callback_url,
            "return_url": frontend_return_url,
            "customization": {
                "title": "ExitAI Premium",
                "description": chapa_description
            }
        }
        
        try:
            response_data = await self.chapa_client.initialize_transaction(chapa_payload)
        except Exception as e:
            logger.error(f"Chapa initialization failed: {str(e)}")
            if hasattr(e, 'response'):
                logger.error(f"Chapa response body: {e.response.text}")
            raise RuntimeError("Payment service is temporarily unavailable")
        
        if response_data.get("status") != "success":
            logger.error(f"Chapa initialization error: {response_data}")
            raise RuntimeError("Payment initialization failed")
        
        checkout_url = response_data["data"]["checkout_url"]
        
        # Create payment record with actual plan amount
        payment = Payment(
            user_id=user.id,
            plan_id=plan.id,
            tx_ref=tx_ref,
            amount=plan.amount,  # Dynamic from database
            currency=plan.currency,
            status=PaymentStatus.PENDING,
            checkout_url=checkout_url
        )
        
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        
        logger.info(f"Payment initialized: tx_ref={tx_ref}, user={user.id}, plan={plan.id}, amount={plan.amount} {plan.currency}")
        
        return payment
    
    async def verify_payment(self, user: User, tx_ref: str) -> Payment:
        """Verify payment with Chapa and activate subscription if valid."""
        
        # Get payment record
        payment = (
            self.db.query(Payment)
            .filter(Payment.tx_ref == tx_ref, Payment.user_id == user.id)
            .first()
        )
        
        if not payment:
            raise ValueError("Payment record not found")
        
        # If already verified successfully, return existing
        if payment.status == PaymentStatus.SUCCESS:
            return payment
        
        # Verify with Chapa
        try:
            chapa_response = await self.chapa_client.verify_transaction(tx_ref)
        except Exception as e:
            logger.error(f"Chapa verification failed: {str(e)}")
            raise RuntimeError("Payment verification service is unavailable")
        
        # Validate Chapa response
        if chapa_response.get("status") != "success":
            payment.status = PaymentStatus.FAILED
            self.db.commit()
            return payment
        
        chapa_data = chapa_response.get("data", {})
        chapa_status = chapa_data.get("status")
        
        # Validate transaction status
        if chapa_status not in ["success", "SUCCESS"]:
            if chapa_status in ["cancelled", "CANCELLED"]:
                payment.status = PaymentStatus.CANCELLED
            elif chapa_status in ["failed", "FAILED"]:
                payment.status = PaymentStatus.FAILED
            elif chapa_status in ["expired", "EXPIRED"]:
                payment.status = PaymentStatus.EXPIRED
            else:
                payment.status = PaymentStatus.FAILED
            self.db.commit()
            return payment
        
        # VALIDATE AMOUNT - Compare with actual payment record (dynamic)
        chapa_amount = float(chapa_data.get("amount", 0))
        expected_amount = float(payment.amount)
        
        if abs(chapa_amount - expected_amount) > 0.01:
            logger.error(
                f"Amount mismatch: expected={expected_amount}, got={chapa_amount}, tx_ref={tx_ref}"
            )
            payment.status = PaymentStatus.FAILED
            self.db.commit()
            raise ValueError("Payment amount mismatch detected")
        
        # VALIDATE CURRENCY
        chapa_currency = chapa_data.get("currency")
        if chapa_currency != payment.currency:
            logger.error(
                f"Currency mismatch: expected={payment.currency}, got={chapa_currency}"
            )
            payment.status = PaymentStatus.FAILED
            self.db.commit()
            raise ValueError("Payment currency mismatch detected")
        
        # Activate subscription
        try:
            self._activate_subscription(user, payment, chapa_data)
        except Exception as e:
            logger.error(f"Failed to activate subscription: {str(e)}")
            self.db.rollback()
            raise RuntimeError("Failed to activate subscription")
        
        logger.info(f"Payment verified successfully: tx_ref={tx_ref}, user={user.id}")
        
        return payment
    
    async def process_webhook(self, payload: dict, signature: str, body: bytes) -> dict:
        """Process Chapa webhook notification."""
        
        if settings.CHAPA_WEBHOOK_SECRET:
            if not signature:
                logger.warning("Webhook received without signature")
                raise ValueError("Missing webhook signature")
            
            computed_hash = hmac.new(
                settings.CHAPA_WEBHOOK_SECRET.encode("utf-8"),
                body,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, computed_hash):
                logger.warning("Invalid webhook signature")
                raise ValueError("Invalid webhook signature")
        
        tx_ref = payload.get("tx_ref")
        if not tx_ref:
            return {"status": "ignored", "message": "Missing tx_ref"}
        
        payment = self.db.query(Payment).filter(Payment.tx_ref == tx_ref).first()
        if not payment:
            return {"status": "ignored", "message": "Payment record not found"}
        
        if payment.status == PaymentStatus.SUCCESS:
            return {"status": "ok", "message": "Already processed"}
        
        user = self.db.get(User, payment.user_id)
        if not user:
            return {"status": "ignored", "message": "User not found"}
        
        try:
            await self.verify_payment(user, tx_ref)
            return {"status": "ok", "message": "Payment verified"}
        except Exception as e:
            logger.error(f"Webhook processing failed: {str(e)}")
            return {"status": "error", "message": "Verification failed"}
    
    def _has_active_premium(self, user: User) -> bool:
        """Check if user has active premium subscription."""
        if user.subscription_tier != SubscriptionTier.PREMIUM:
            return False
        
        if user.subscription_expires_at:
            now = datetime.now(timezone.utc)
            if user.subscription_expires_at <= now:
                user.subscription_tier = SubscriptionTier.FREE
                self.db.commit()
                return False
        
        return True
    
    def _activate_subscription(self, user: User, payment: Payment, chapa_data: dict) -> None:
        """Activate premium subscription for user."""
        
        payment.status = PaymentStatus.SUCCESS
        payment.chapa_transaction_id = chapa_data.get("reference")
        payment.verified_at = datetime.now(timezone.utc)
        
        plan = payment.plan
        expires_at = self.calculate_expiry_date(plan)
        
        subscription = Subscription(
            user_id=user.id,
            payment_id=payment.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            started_at=datetime.now(timezone.utc),
            expires_at=expires_at
        )
        
        self.db.add(subscription)
        
        user.subscription_tier = SubscriptionTier.PREMIUM
        user.subscription_expires_at = expires_at
        
        self.db.commit()
        
        logger.info(
            f"Premium activated: user={user.id}, plan={plan.name}, "
            f"expires_at={expires_at}"
        )
        
        send_payment_confirmation_email(
            to_email=user.email,
            full_name=user.full_name,
            amount=float(payment.amount),
            currency=payment.currency,
            plan_name=plan.name
        )