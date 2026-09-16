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
from app.core.telegram import notify_new_manual_payment
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


# ============================================================
# REJECTION REASONS
# ============================================================
# Preset reasons an admin can pick when rejecting a manual payment.
# Each entry stores:
#   label    - short label shown in the admin UI
#   message  - long friendly explanation sent to the student
#   next_step - optional custom "what to do" hint (falls back to generic)
REJECTION_REASONS: dict[str, dict[str, str]] = {
    "reference_not_found": {
        "label": "Reference not found in our bank account",
        "message": "We couldn't find this reference number in our bank account.",
        "next_step": "Double-check the reference number on your receipt, then resubmit.",
    },
    "amount_mismatch": {
        "label": "Amount doesn't match the plan price",
        "message": "The amount you sent doesn't match the plan price.",
        "next_step": "Please send the exact amount shown on the pricing page and submit a new reference.",
    },
    "transaction_too_old": {
        "label": "Transaction is too old",
        "message": "This transaction is more than 3 days old.",
        "next_step": "Please make a fresh transfer and submit the new reference.",
    },
    "duplicate_reference": {
        "label": "Reference already used",
        "message": "This reference number was already used for another payment.",
        "next_step": "Each reference can only be used once. Please make a new payment.",
    },
    "wrong_recipient": {
        "label": "Sent to wrong account",
        "message": "The payment was sent to a different account, not the one shown here.",
        "next_step": "Please send the payment to the account number shown in the app.",
    },
    "incomplete_payment": {
        "label": "Incomplete payment",
        "message": "The payment looks incomplete or partial.",
        "next_step": "Please complete the transfer and resubmit with the full amount.",
    },
    "reference_mistyped": {
        "label": "Reference mistyped",
        "message": "The reference number appears to have been mistyped.",
        "next_step": "Please double-check the number on your receipt and submit the exact reference.",
    },
    "sender_unverified": {
        "label": "Sender could not be verified",
        "message": "We couldn't verify the sender of this payment.",
        "next_step": "Please contact support with a screenshot of your transfer receipt.",
    },
    "suspected_fraud": {
        "label": "Flagged for review",
        "message": "This payment has been flagged for review.",
        "next_step": "Please contact support to resolve this.",
    },
    "other": {
        "label": "Other (custom reason)",
        "message": "Your payment could not be verified.",
        "next_step": None,
    },
}


def build_rejection_note(reason_code: str, custom_text: str | None = None) -> str:
    """Return a storable note combining the reason code and human text.

    Format: '[code] Message — Next step' (next step omitted if not set).
    For 'other', the custom text is used as the message.
    """
    entry = REJECTION_REASONS.get(reason_code)
    if entry is None:
        # Unknown code — just store whatever text came in.
        return custom_text or "Your payment could not be verified."

    if reason_code == "other":
        message = custom_text or "Your payment could not be verified."
        return f"[other] {message}"

    message = entry["message"]
    next_step = entry.get("next_step")
    if next_step:
        return f"[{reason_code}] {message} — {next_step}"
    return f"[{reason_code}] {message}"


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
        """First-pass check: does the reference look like a valid
        reference for this bank?

        This is NOT payment verification. It only rejects obvious typos
        and garbage. The real verification is a human comparing the
        reference against the actual bank statement in the admin queue.
        """
        pattern = BANK_REFERENCE_PATTERNS.get(bank)
        if not pattern:
            raise ManualPaymentError(f"Unsupported bank: {bank}")
        if not re.match(pattern, reference):
            raise ManualPaymentError(
                f"Reference format doesn't match {BANK_DISPLAY_NAMES[bank]}. "
                f"Please double-check and try again."
            )

    def _append_audit(
        self,
        payment: Payment,
        event: str,
        actor_id: Optional[uuid.UUID] = None,
        **extra,
    ) -> None:
        """Append a structured audit event to the payment record.

        Never raises — audit is best-effort. Payment flow continues
        even if this fails for any reason.
        """
        try:
            log = list(payment.manual_audit_log or [])
            entry = {
                "event": event,
                "at": datetime.now(timezone.utc).isoformat(),
            }
            if actor_id is not None:
                entry["by"] = str(actor_id)
            for k, v in extra.items():
                if v is not None:
                    entry[k] = v
            log.append(entry)
            payment.manual_audit_log = log
        except Exception as e:
            logger.warning(f"Audit append failed for event={event}: {e}")

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
        self._append_audit(
            payment, "initiated",
            actor_id=user.id, bank=bank.value,
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
        accepted_terms: bool = False,
        confirmed_amount: str = "",
    ) -> Payment:
        """Student submits the bank reference after paying."""

        self._assert_user_active(user)

        # ── Confirmation gates ────────────────────────────────
        # Backend is the final authority — even if a malicious
        # client skips the frontend checkboxes, we reject here.
        if not accepted_terms:
            raise ManualPaymentError(
                "You must confirm both statements before submitting."
            )

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

        # ── Amount confirmation ───────────────────────────────
        # The student must type the exact amount they sent. This
        # acts as a second confirmation gate and creates an audit
        # trail we can reference if there's a later dispute.
        try:
            typed_amount = float(confirmed_amount.replace(",", "").strip())
        except (ValueError, AttributeError):
            raise ManualPaymentError(
                "Please type the amount you sent (e.g. 500)."
            )

        expected_amount = float(payment.amount)
        if abs(typed_amount - expected_amount) > 0.01:
            raise ManualPaymentError(
                f"The amount you typed ({typed_amount:g} {payment.currency}) "
                f"doesn't match the plan price "
                f"({expected_amount:g} {payment.currency})."
            )

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
        # Record the student's explicit confirmation BEFORE storing
        # the detail — this proves they claimed the payment.
        self._append_audit(
            payment, "terms_accepted",
            actor_id=user.id,
            confirmed_amount=confirmed_amount,
            expected_amount=str(payment.amount),
        )
        self._append_audit(
            payment, "submitted",
            actor_id=user.id,
            reference=bank_reference,
            sender_name=sender_name,
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

        # Telegram ping to admin (best-effort, non-blocking)
        try:
            plan = self.db.get(PricingPlan, payment.plan_id)
            notify_new_manual_payment(
                student_name=user.full_name or "Student",
                student_email=user.email,
                plan_name=plan.name if plan else "Premium",
                amount=float(payment.amount),
                currency=payment.currency,
                bank=bank.value,
                reference=bank_reference,
                sender_name=sender_name,
                sender_phone=sender_phone,
                note=student_note,
            )
        except Exception as e:
            logger.warning(f"Telegram notify failed: {e}")

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

        self._append_audit(payment, "cancelled", actor_id=user.id)
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

        self._append_audit(
            payment, "approved",
            bank_reference=detail.bank_reference,
            note=admin_note,
        )
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
        self,
        payment_id: uuid.UUID,
        reason: str,
        reason_code: str | None = None,
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
        # Store a formatted note that includes the reason code (for
        # analytics) plus the human-readable message (for the student).
        note = reason
        if reason_code:
            note = build_rejection_note(reason_code, custom_text=reason)

        if detail:
            detail.admin_note = note

        self._append_audit(
            payment, "rejected",
            reason=reason,
            reason_code=reason_code,
        )
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