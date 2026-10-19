"""
Telegram notification helper.

Sends messages to an admin chat via the Bot API.
Fails silently — notifications are best-effort and must never
break the business flow.
"""

import logging
import threading

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_sync(text: str, parse_mode: str = "HTML") -> bool:
    """Send a message synchronously. Returns True on success."""
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
    chat_id = getattr(settings, "TELEGRAM_ADMIN_CHAT_ID", "") or ""

    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200 and resp.json().get("ok"):
                return True
            logger.warning(
                f"Telegram send failed: status={resp.status_code} "
                f"body={resp.text[:200]}"
            )
            return False
    except Exception as e:
        logger.warning(f"Telegram send exception: {e}")
        return False


def _send_with_keyboard(text: str, reply_markup: dict) -> None:
    """Fire-and-forget Telegram send with an inline keyboard."""
    if not getattr(settings, "TELEGRAM_BOT_TOKEN", "") or not getattr(
        settings, "TELEGRAM_ADMIN_CHAT_ID", ""
    ):
        return

    def _send():
        token = settings.TELEGRAM_BOT_TOKEN
        chat_id = settings.TELEGRAM_ADMIN_CHAT_ID
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": reply_markup,
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json=payload)
                if not (resp.status_code == 200 and resp.json().get("ok")):
                    logger.warning(
                        f"Telegram keyboard send failed: {resp.text[:200]}"
                    )
        except Exception as e:
            logger.warning(f"Telegram keyboard send exception: {e}")

    threading.Thread(target=_send, daemon=True).start()


def notify_new_manual_payment(
    student_name: str,
    student_email: str,
    plan_name: str,
    amount: float,
    currency: str,
    bank: str,
    reference: str,
    payment_id: str,
    sender_name: str | None = None,
    sender_phone: str | None = None,
    note: str | None = None,
) -> None:
    """Admin notification when a student submits a manual bank payment.

    Includes an inline Approve button. The button carries the payment_id
    so the webhook knows which payment to approve.
    """
    bank_display = {
        "cbe": "CBE",
        "telebirr": "Telebirr",
        "awash": "Awash Bank",
    }.get(bank.lower(), bank.upper())

    lines = [
        "🔔 <b>New Manual Payment</b>",
        "",
        f"👤 <b>Student:</b> {student_name or 'Student'}",
        f"📧 {student_email}",
        f"💎 <b>Plan:</b> {plan_name}",
        f"💰 <b>Amount:</b> {amount} {currency}",
        f"🏦 <b>Bank:</b> {bank_display}",
        f"🔖 <b>Reference:</b> <code>{reference}</code>",
    ]

    if sender_name:
        lines.append(f"✍️ <b>Sender:</b> {sender_name}")
    if sender_phone:
        lines.append(f"📱 <b>Phone:</b> {sender_phone}")
    if note:
        lines.append(f"📝 <b>Note:</b> {note}")

    lines.append("")
    lines.append("👉 Review at: /admin/manual-payments")

    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": f"✅ Approve · {reference}",
                    "callback_data": f"approve:{payment_id}",
                }
            ]
        ]
    }

    _send_with_keyboard("\n".join(lines), reply_markup)


def notify_new_support_ticket(
    ticket_id: str,
    email: str,
    issue_type: str,
    subject: str,
    message_preview: str,
) -> None:
    """Admin notification when a new support ticket is created."""
    # Friendly emoji per issue type — helps you triage at a glance
    type_emoji = {
        "payment": "💰",
        "refund": "💸",
        "account_reactivation": "🔓",
        "account_issues": "👤",
        "technical": "🔧",
        "content": "📚",
        "feedback": "💡",
        "other": "📩",
    }.get(issue_type.lower(), "📩")

    lines = [
        f"{type_emoji} <b>New Support Ticket</b>",
        "",
        f"<b>Type:</b> {issue_type.replace('_', ' ').title()}",
        f"<b>From:</b> {email}",
        f"<b>Subject:</b> {subject}",
        "",
        f"<b>Message:</b>",
        f"<i>{message_preview}</i>",
        "",
        f"Ticket ID: <code>{ticket_id[:8]}</code>",
        "👉 Review at: /admin/support",
    ]

    send_telegram_async("\n".join(lines))
