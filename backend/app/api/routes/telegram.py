"""
Telegram bot webhook — handles inline button callbacks.

Security:
  1. Every incoming request must include X-Telegram-Bot-Api-Secret-Token
     matching TELEGRAM_WEBHOOK_SECRET.
  2. The callback_query.from.id must match TELEGRAM_ADMIN_CHAT_ID.
  3. Approvals delegate to ManualPaymentService.approve() — the same
     code path the web admin panel uses.
"""
import logging
import uuid as _uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


def _answer_callback(callback_id: str, text: str, show_alert: bool = False) -> None:
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
    if not token or not callback_id:
        return
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"https://api.telegram.org/bot{token}/answerCallbackQuery",
                json={
                    "callback_query_id": callback_id,
                    "text": text,
                    "show_alert": show_alert,
                },
            )
    except Exception as e:
        logger.warning(f"answerCallbackQuery failed: {e}")


def _edit_message_text(
    chat_id: int, message_id: int, text: str, parse_mode: str = "HTML"
) -> None:
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
    if not token:
        return
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"https://api.telegram.org/bot{token}/editMessageText",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": text,
                    "parse_mode": parse_mode,
                    "disable_web_page_preview": True,
                },
            )
    except Exception as e:
        logger.warning(f"editMessageText failed: {e}")


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    # 1. Verify the request is really from Telegram
    expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or ""
    if not expected:
        logger.error("TELEGRAM_WEBHOOK_SECRET is not configured — rejecting webhook")
        raise HTTPException(status_code=500, detail="Webhook not configured")

    if (
        not x_telegram_bot_api_secret_token
        or x_telegram_bot_api_secret_token != expected
    ):
        logger.warning("Telegram webhook: invalid secret token")
        raise HTTPException(status_code=403, detail="Forbidden")

    # 2. Parse update
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    callback = update.get("callback_query")
    if not callback:
        return {"ok": True}

    callback_id = callback.get("id")
    data = callback.get("data", "")
    from_user = callback.get("from", {}) or {}
    message = callback.get("message", {}) or {}
    chat_id = (message.get("chat") or {}).get("id")
    message_id = message.get("message_id")

    # 3. Verify click came from admin
    admin_chat_id = str(
        getattr(settings, "TELEGRAM_ADMIN_CHAT_ID", "") or ""
    ).strip()
    if str(from_user.get("id")) != admin_chat_id:
        logger.warning(
            f"Telegram webhook: click from unauthorized user {from_user.get('id')}"
        )
        _answer_callback(
            callback_id,
            "You are not authorized to approve payments.",
            show_alert=True,
        )
        return {"ok": True}

    # 4. Only handle approve
    if not data.startswith("approve:"):
        _answer_callback(callback_id, "Unknown action.", show_alert=True)
        return {"ok": True}

    payment_id_str = data.split(":", 1)[1]
    try:
        payment_id = _uuid.UUID(payment_id_str)
    except ValueError:
        _answer_callback(callback_id, "Invalid payment ID.", show_alert=True)
        return {"ok": True}

    # 5. Delegate to service
    from app.services.manual_payment_service import (
        ManualPaymentError,
        ManualPaymentService,
    )

    service = ManualPaymentService(db)
    try:
        service.approve(
            payment_id=payment_id,
            admin_note="Approved via Telegram",
        )
    except ManualPaymentError as e:
        msg = str(e)
        logger.info(f"Telegram approve failed for {payment_id}: {msg}")
        _answer_callback(callback_id, msg, show_alert=True)
        if chat_id and message_id:
            _edit_message_text(
                chat_id,
                message_id,
                f"⚠️ <b>Approve failed</b>\n\n{msg}",
            )
        return {"ok": True}
    except Exception as e:
        logger.error(f"Telegram approve unexpected error: {e}", exc_info=True)
        _answer_callback(
            callback_id, "Unexpected error. Check server logs.", show_alert=True
        )
        return {"ok": True}

    # 6. Success
    _answer_callback(callback_id, "Payment approved ✓")

    if chat_id and message_id:
        original_text = message.get("text", "Manual payment notification")
        approved_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        _edit_message_text(
            chat_id,
            message_id,
            f"{original_text}\n\n✅ <b>Approved</b> · {approved_at}\n<i>Premium activated.</i>",
        )

    return {"ok": True}