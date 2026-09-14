"""
Manual payment service.

Handles the manual bank-transfer flow: student initiates a payment,
sends money to a bank account, submits the reference number, and an
admin verifies and approves/rejects.

Shares the payments + manual_payment_details tables with the Chapa
flow. Premium activation reuses PaymentService._activate_subscription
so both paths behave identically.
"""
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import (
    send_manual_payment_pending_email,
    send_manual_payment_rejected_email,
)
from app.models.payment import (
    Payment,
    PaymentStatus,
    PricingPlan,
    Subscription,
)
from app.models.user import User, SubscriptionTier

from app.schemas.manual_payment import (
    ManualBank,
    BANK_REFERENCE_PATTERNS,
    BankAccountInfo,
)

logger = logging.getLogger(__name__)


# ============================================================
# CONSTANTS
# ============================================================

BANK_DISPLAY_NAMES = {
    ManualBank.CBE: "Commercial Bank of Ethiopia (CBE)",
    ManualBank.TELEBIRR: "Telebirr",
    ManualBank.AWASH: "Awash Bank",
}


class ManualPaymentError(Exception):
    """Business logic error - returned to the user as a 400."""
    pass


class ManualPaymentService:
    """Manual bank-transfer payment flow."""

    def __init__(self, db: Session):
        self.db = db

    # ============================================================
    # BANK ACCOUNT INFO (from env)
    # ============================================================

    def _bank_accounts(self) -> dict[ManualBank, tuple[str, str]]:
        """Return {bank: (account_number, account_name)} from settings.
        Only returns banks that have BOTH values set."""
        out: dict[ManualBank, tuple[str, str]] = {}

        if settings.MANUAL_CBE_ACCOUNT and settings.MANUAL_CBE_NAME:
            out[ManualBank.CBE] = (
                settings.MANUAL_CBE_ACCOUNT,
                settings.MANUAL_CBE_NAME,
            )
        if settings.MANUAL_TELEBIRR_PHONE and settings.MANUAL_TELEBIRR_NAME:
            out[ManualBank.TELEBIRR] = (
                settings.MANUAL_TELEBIRR_PHONE,
                settings.MANUAL_TELEBIRR_NAME,
            )
        if settings.MANUAL_AWASH_ACCOUNT and settings.MANUAL_AWASH_NAME:
            out[ManualBank.AWASH] = (
                settings.MANUAL_AWASH_ACCOUNT,
                settings.MANUAL_AWASH_NAME,
            )
        return out

    def get_available_banks(self) -> list[BankAccountInfo]:
        """List of banks students can pay to."""
        result: list[BankAccountInfo] = []
        for bank, (acct, name) in self._bank_accounts().items():
            result.append(BankAccountInfo(
                bank=bank,
                account_number=acct,
                account_name=name,
                display_name=BANK_DISPLAY_NAMES[bank],
            ))
        return result

    # ============================================================
    # VALIDATION HELPERS
    # ============================================================

    def _assert_user_active(self, user: User) -> None:
        """Refuse to proceed if the account is banned/deactivated.

        Even though get_current_user usually blocks this at login,
        an old JWT could still work briefly after a ban — so we
        double-check here before creating or accepting payments.
        """
        if not getattr(user, "is_active", True):
            raise ManualPaymentError(
                "Your account is suspended. Please contact support."
            )

    def _has_active_premium(self, user: User) -> bool:
        if user.subscription_tier != SubscriptionTier.PREMIUM:
            return False
        if user.subscription_expires_at:
            now = datetime.now(timezone.utc)
            if user.subscription_expires_at <= now:
                return False
        return True

    def _validate_bank_reference_format(
        self, bank: ManualBank, reference: str
    ) -> None:
        pattern = BANK_REFERENCE_PATTERNS.get(bank)
        if not pattern:
            raise ManualPaymentError(f"Unsupported bank: {bank}")
        if not re.match(pattern, reference):
            raise ManualPaymentError(
                f"Reference format doesn't match {BANK_DISPLAY_NAMES[bank]}. "
                f"Please double-check and try again."
            )

    def _generate_tx_ref(self, bank: ManualBank) -> str:
        """Unique manual tx_ref, prefixed by bank for easy admin scanning."""
        return f"MANUAL-{bank.value.upper()}-{uuid.uuid4().hex[:12].upper()}"

    # ============================================================
    # INITIATE
    # ============================================================

    def initiate(
        self, user: User, plan_id: uuid.UUID, bank: ManualBank
    ) -> Payment:
        """Create a pending Payment row for a manual transfer."""

        self._assert_user_active(user)

        if self._has_active_premium(user):
            raise ManualPaymentError("You already have active Premium.")

        # Check bank is enabled
        accounts = self._bank_accounts()
        if bank not in accounts:
            raise ManualPaymentError(
                f"{BANK_DISPLAY_NAMES[bank]} is not available right now."
            )

        # Check no other pending manual payment
        existing_pending = (
            self.db.query(Payment)
            .filter(
                Payment.user_id == user.id,
                Payment.status == PaymentStatus.PENDING,
                Payment.payment_method.like("manual_%"),
            )
            .first()
        )
        if existing_pending:
            raise ManualPaymentError(
                "You already have a pending manual payment. "
                "Please wait for admin verification or cancel it first."
            )

        # Load plan
        plan = self.db.get(PricingPlan, plan_id)
        if not plan or not plan.is_active or plan.is_archived:
            raise ManualPaymentError("Invalid or inactive pricing plan.")

        tx_ref = self._generate_tx_ref(bank)

        payment = Payment(
            user_id=user.id,
            plan_id=plan.id,
            tx_ref=tx_ref,
            amount=plan.amount,
            currency=plan.currency,
            status=PaymentStatus.PENDING,
            checkout_url=None,
            chapa_transaction_id=None,
            payment_method=f"manual_{bank.value}",
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)

        logger.info(
            f"Manual payment initiated: tx_ref={tx_ref}, user={user.id}, "
            f"bank={bank.value}, amount={plan.amount} {plan.currency}"
        )
        return payment

    # ============================================================
    # SUBMIT REFERENCE
    # ============================================================

    def submit_reference(
        self,
        user: User,
        tx_ref: str,
        bank_reference: str,
        sender_name: Optional[str],
        sender_phone: Optional[str],
        student_note: Optional[str],
    ) -> Payment:
        """Student submits the bank reference after paying."""

        self._assert_user_active(user)

        payment = (
            self.db.query(Payment)
            .filter(
                Payment.tx_ref == tx_ref,
                Payment.user_id == user.id,
            )
            .first()
        )
        if not payment:
            raise ManualPaymentError("Payment session not found.")

        if payment.status != PaymentStatus.PENDING:
            raise ManualPaymentError(
                f"Payment is already {payment.status.value}."
            )

        if not payment.payment_method or not payment.payment_method.startswith("manual_"):
            raise ManualPaymentError("Not a manual payment.")

        bank = ManualBank(payment.payment_method.replace("manual_", ""))

        # Validate reference format
        self._validate_bank_reference_format(bank, bank_reference)

        # Check the reference hasn't been submitted before
        from app.models.payment import ManualPaymentDetail

        duplicate = (
            self.db.query(ManualPaymentDetail)
            .filter(ManualPaymentDetail.bank_reference == bank_reference)
            .first()
        )
        if duplicate:
            # Determine whether this is the same user or another user
            dup_payment = self.db.get(Payment, duplicate.payment_id)
            same_user = dup_payment is not None and dup_payment.user_id == user.id

            if same_user:
                if dup_payment.status == PaymentStatus.PENDING:
                    raise ManualPaymentError(
                        "You already submitted this reference. "
                        "Please wait for admin verification — check "
                        "'My Bank Payments' for the status."
                    )
                elif dup_payment.status == PaymentStatus.SUCCESS:
                    raise ManualPaymentError(
                        "This reference was already approved. "
                        "If you made a second payment with the same "
                        "reference, please contact support."
                    )
                else:
                    raise ManualPaymentError(
                        "This reference was already submitted and "
                        "could not be verified. If you have a new "
                        "receipt, please double-check the reference."
                    )
            else:
                # Another user submitted this reference.
                # Don't leak the other user's identity — just say it's in use.
                raise ManualPaymentError(
                    "This reference is already in use. "
                    "If you believe this is a mistake, please contact support."
                )

        detail = ManualPaymentDetail(
            payment_id=payment.id,
            bank_name=bank.value,
            bank_reference=bank_reference,
            sender_name=sender_name,
            sender_phone=sender_phone,
            student_note=student_note,
        )
        self.db.add(detail)
        self.db.commit()
        self.db.refresh(payment)

        logger.info(
            f"Manual payment submitted: tx_ref={tx_ref}, "
            f"bank_ref={bank_reference}, user={user.id}"
        )

        # Email confirmation (best-effort, in background)
        try:
            send_manual_payment_pending_email(
                to_email=user.email,
                full_name=user.full_name or "Student",
                amount=float(payment.amount),
                currency=payment.currency,
                bank_display=BANK_DISPLAY_NAMES[bank],
                reference=bank_reference,
            )
        except Exception as e:
            logger.warning(f"Pending email failed: {e}")

        return payment

    # ============================================================
    # STATUS (student view)
    # ============================================================

    def list_user_manual_payments(self, user: User) -> list[dict]:
        from app.models.payment import ManualPaymentDetail

        rows = (
            self.db.query(Payment, ManualPaymentDetail)
            .outerjoin(ManualPaymentDetail, ManualPaymentDetail.payment_id == Payment.id)
            .filter(
                Payment.user_id == user.id,
                Payment.payment_method.like("manual_%"),
            )
            .order_by(Payment.created_at.desc())
            .all()
        )

        out = []
        for payment, detail in rows:
            bank_value = (payment.payment_method or "manual_cbe").replace("manual_", "")
            out.append({
                "payment_id": payment.id,
                "tx_ref": payment.tx_ref,
                "bank": bank_value,
                "amount": float(payment.amount),
                "currency": payment.currency,
                "status": payment.status,
                "bank_reference": detail.bank_reference if detail else "",
                "sender_name": detail.sender_name if detail else None,
                "created_at": payment.created_at,
                "verified_at": payment.verified_at,
                "admin_note": detail.admin_note if detail else None,
            })
        return out

    # ============================================================
    # USER — CANCEL PENDING PAYMENT
    # ============================================================

    def cancel_pending(self, user: User, payment_id: uuid.UUID) -> Payment:
        """Student cancels their own pending manual payment.

        Deletes the associated manual_payment_details row so the same
        bank reference can be resubmitted against a fresh payment
        (useful if they made a typo the first time).
        """
        from app.models.payment import ManualPaymentDetail

        payment = self.db.get(Payment, payment_id)
        if not payment:
            raise ManualPaymentError("Payment not found.")

        # Ownership check — critical (IDOR protection)
        if payment.user_id != user.id:
            raise ManualPaymentError("You can only cancel your own payments.")

        if not payment.payment_method or not payment.payment_method.startswith("manual_"):
            raise ManualPaymentError("Not a manual payment.")

        if payment.status != PaymentStatus.PENDING:
            raise ManualPaymentError(
                f"Cannot cancel a payment that is already "
                f"{payment.status.value}."
            )

        # Mark as cancelled
        payment.status = PaymentStatus.CANCELLED
        payment.verified_at = datetime.now(timezone.utc)

        # Remove the submitted detail (frees up the bank reference)
        detail = (
            self.db.query(ManualPaymentDetail)
            .filter(ManualPaymentDetail.payment_id == payment.id)
            .first()
        )
        if detail:
            self.db.delete(detail)

        self.db.commit()
        self.db.refresh(payment)

        logger.info(
            f"Manual payment cancelled by user: payment_id={payment.id}, "
            f"user={user.id}, tx_ref={payment.tx_ref}"
        )

        return payment

    # ============================================================
    # ADMIN — LIST PENDING
    # ============================================================

    def list_pending_for_admin(self) -> list[dict]:
        from app.models.payment import ManualPaymentDetail

        rows = (
            self.db.query(Payment, ManualPaymentDetail, User, PricingPlan)
            .join(ManualPaymentDetail, ManualPaymentDetail.payment_id == Payment.id)
            .join(User, User.id == Payment.user_id)
            .join(PricingPlan, PricingPlan.id == Payment.plan_id)
            .filter(Payment.status == PaymentStatus.PENDING)
            .order_by(ManualPaymentDetail.created_at.asc())
            .all()
        )

        out = []
        for payment, detail, user, plan in rows:
            bank_value = (payment.payment_method or "manual_cbe").replace("manual_", "")
            out.append({
                "payment_id": payment.id,
                "tx_ref": payment.tx_ref,
                "user_id": user.id,
                "user_email": user.email,
                "user_full_name": user.full_name,
                "plan_name": plan.name,
                "amount": float(payment.amount),
                "currency": payment.currency,
                "status": payment.status,
                "bank": bank_value,
                "bank_reference": detail.bank_reference,
                "sender_name": detail.sender_name,
                "sender_phone": detail.sender_phone,
                "student_note": detail.student_note,
                "admin_note": detail.admin_note,
                "created_at": detail.created_at,
                "verified_at": payment.verified_at,
            })
        return out

    # ============================================================
    # ADMIN — APPROVE
    # ============================================================

    def approve(
        self, payment_id: uuid.UUID, admin_note: Optional[str]
    ) -> Payment:
        """Admin approves a manual payment → activates Premium."""
        from app.models.payment import ManualPaymentDetail
        from app.services.payment_service import PaymentService

        payment = self.db.get(Payment, payment_id)
        if not payment:
            raise ManualPaymentError("Payment not found.")

        if payment.status != PaymentStatus.PENDING:
            raise ManualPaymentError(
                f"Payment is already {payment.status.value}."
            )

        if not payment.payment_method or not payment.payment_method.startswith("manual_"):
            raise ManualPaymentError("Not a manual payment.")

        user = self.db.get(User, payment.user_id)
        if not user:
            raise ManualPaymentError("User not found.")

        detail = (
            self.db.query(ManualPaymentDetail)
            .filter(ManualPaymentDetail.payment_id == payment.id)
            .first()
        )

        if not detail:
            raise ManualPaymentError(
                "Student has not submitted a bank reference yet."
            )

        # Delegate activation to PaymentService (shared path with Chapa)
        ps = PaymentService(self.db)
        ps.activate_manual_subscription(
            user=user,
            payment=payment,
            bank_reference=detail.bank_reference,
        )

        if admin_note:
            detail.admin_note = admin_note
            self.db.commit()

        logger.info(
            f"Manual payment approved: payment_id={payment.id}, "
            f"user={user.id}, tx_ref={payment.tx_ref}"
        )

        # NOTE: _activate_subscription (called above) sends the standard
        # "payment received / premium active" confirmation email. We do NOT
        # send a second email here to avoid duplicate notifications.

        return payment

    # ============================================================
    # ADMIN — REJECT
    # ============================================================

    def reject(
        self, payment_id: uuid.UUID, reason: str
    ) -> Payment:
        from app.models.payment import ManualPaymentDetail

        payment = self.db.get(Payment, payment_id)
        if not payment:
            raise ManualPaymentError("Payment not found.")

        if payment.status != PaymentStatus.PENDING:
            raise ManualPaymentError(
                f"Payment is already {payment.status.value}."
            )

        if not payment.payment_method or not payment.payment_method.startswith("manual_"):
            raise ManualPaymentError("Not a manual payment.")

        payment.status = PaymentStatus.FAILED
        payment.verified_at = datetime.now(timezone.utc)

        detail = (
            self.db.query(ManualPaymentDetail)
            .filter(ManualPaymentDetail.payment_id == payment.id)
            .first()
        )
        if detail:
            detail.admin_note = reason

        self.db.commit()
        self.db.refresh(payment)

        user = self.db.get(User, payment.user_id)
        logger.info(
            f"Manual payment rejected: payment_id={payment.id}, reason={reason}"
        )

        try:
            if user:
                send_manual_payment_rejected_email(
                    to_email=user.email,
                    full_name=user.full_name or "Student",
                    reason=reason,
                )
        except Exception as e:
            logger.warning(f"Rejection email failed: {e}")

        return payment