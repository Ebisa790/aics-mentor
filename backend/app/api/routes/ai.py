from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import time

from app.api.deps import get_current_user
from app.core.ai_client import DEFAULT_MODEL, get_groq_client
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.user import SubscriptionTier, User, UserRole

router = APIRouter(prefix="/api/ai", tags=["AI Assistance"])

FREE_TIER_DAILY_AI_LIMIT = 5


class ChatMessage(BaseModel):
    role: str
    content: str


class ExplainRequest(BaseModel):
    question_id: str
    question_text: str
    options: Dict[str, str]
    selected_option: str
    correct_option: str
    messages: Optional[List[ChatMessage]] = []


def _build_fallback_explanation(req: ExplainRequest) -> str:
    """Plain, honest explanation when the AI is unavailable."""
    correct = req.correct_option
    correct_text = req.options.get(correct, "")
    picked = req.selected_option

    parts = [
        f"**Why {correct} is correct** — {correct_text or 'This option matches the concept tested in the question.'}",
        "**Key concept** — Review the related topic in your course notes to reinforce the underlying idea.",
        "**Remember** — Check the explanation in the course material for the full reasoning.",
    ]

    if picked and picked != correct:
        parts.append(
            f"_You picked {picked}. Compare it closely with {correct} to spot the difference._"
        )

    return "\n\n".join(parts)


@router.post("/explain-question")
@limiter.limit("10/minute")
async def explain_question(
    request: Request,
    req: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a short structured AI explanation, with safe fallbacks."""
    import logging
    logger = logging.getLogger(__name__)

    # 1. Tier & Access Check
    is_premium_or_admin = (
        current_user.subscription_tier == SubscriptionTier.PREMIUM
        or current_user.role == UserRole.ADMIN
    )

    # 2. Reset daily counter if it's a new day
    from datetime import datetime
    last_usage = getattr(current_user, "last_ai_usage_date", None)
    today = datetime.utcnow().date()
    if last_usage:
        last_usage_date = (
            last_usage.date() if isinstance(last_usage, datetime) else last_usage
        )
        if last_usage_date < today:
            current_user.ai_usage_count = 0
            current_user.last_ai_usage_date = datetime.utcnow()
            db.commit()

    # 3. Enforce free-tier daily limit
    current_ai_usage = getattr(current_user, "ai_usage_count", 0)
    if not is_premium_or_admin and current_ai_usage >= FREE_TIER_DAILY_AI_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"You have reached your daily limit of "
                f"{FREE_TIER_DAILY_AI_LIMIT} AI explanations."
            ),
        )

    # 4. Get client
    client = get_groq_client()
    if not client:
        logger.error("Groq client unavailable — returning fallback explanation")
        return {
            "explanation": _build_fallback_explanation(req),
            "is_mock": True,
        }

    # 5. Build prompt
    system_instruction = (
        "You are a concise CS tutor. Write exam explanations for university students.\n"
        "STRICT RULES:\n"
        "- Response length: 100-140 words. NO EXCEPTIONS.\n"
        "- No preamble, no greeting, no 'Great question'.\n"
        "- Do NOT explain every wrong option.\n"
        "- Use simple Markdown. Only one code block if absolutely necessary."
    )

    initial_prompt = f"""Question: {req.question_text}

A: {req.options.get('A', '')}
B: {req.options.get('B', '')}
C: {req.options.get('C', '')}
D: {req.options.get('D', '')}

Correct answer: {req.correct_option}
Student picked: {req.selected_option}

Write a short explanation with exactly these 3 parts:

**Why {req.correct_option} is correct** — 2-3 sentences.

**Key concept** — 1 sentence naming the underlying CS concept.

**Remember** — 1 sentence memory hook.

Stick to the 3 sections above. Nothing else."""

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": initial_prompt},
    ]

    # 6. Try models × retries
    models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]
    ai_explanation = None
    last_error = None

    for attempt in range(2):  # 2 attempts total (1 retry)
        for model in models:
            try:
                logger.info(f"Attempt {attempt + 1}, model={model}")
                completion = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=500,   # bumped from 350 to prevent truncation
                )
                text = completion.choices[0].message.content
                if text and text.strip():
                    ai_explanation = text
                    logger.info(f"Success with model: {model}")
                    break
            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
                logger.warning(f"Model {model} failed: {last_error}")
                continue
        if ai_explanation:
            break
        if attempt == 0:
            time.sleep(1)  # brief pause before retry

    # 7. Increment usage only if we actually got a real AI response
    if not is_premium_or_admin and ai_explanation:
        current_user.ai_usage_count += 1
        current_user.last_ai_usage_date = datetime.utcnow()
        db.commit()

    # 8. Return — real AI if we got it, otherwise a built-in fallback
    if ai_explanation:
        return {"explanation": ai_explanation, "is_mock": False}

    logger.error(f"All AI attempts failed. Last error: {last_error}")
    return {
        "explanation": _build_fallback_explanation(req),
        "is_mock": True,
    }