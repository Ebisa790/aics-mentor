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


def send_telegram_async(text: str, parse_mode: str = "HTML") -> None:
    """Fire-and-forget Telegram notification (background thread)."""
    if not getattr(settings, "TELEGRAM_BOT_TOKEN", "") or not getattr(
        settings, "TELEGRAM_ADMIN_CHAT_ID", ""
    ):
        return

    threading.Thread(
        target=_send_sync,
        args=(text, parse_mode),
        daemon=True,
    ).start()


def notify_new_manual_payment(
    student_name: str,
    student_email: str,
    plan_name: str,
    amount: float,
    currency: str,
    bank: str,
    reference: str,
    sender_name: str | None = None,
    sender_phone: str | None = None,
    note: str | None = None,
) -> None:
    """Admin notification when a student submits a manual bank payment."""
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

    send_telegram_async("\n".join(lines))