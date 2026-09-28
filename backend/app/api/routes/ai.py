from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.ai_client import DEFAULT_MODEL, get_groq_client
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.user import SubscriptionTier, User, UserRole

router = APIRouter(prefix="/api/ai", tags=["AI Assistance"])

# Daily limit for free tier users
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


@router.post("/explain-question")
@limiter.limit("5/minute")
async def explain_question(
    request: Request,
    req: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a short, structured AI explanation for an exam question.
    Target length: 100-150 words.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # 1. Tier & Access Check
        is_premium_or_admin = (
            current_user.subscription_tier == SubscriptionTier.PREMIUM
            or current_user.role == UserRole.ADMIN
        )

        # Reset AI usage count if it's a new day
        from datetime import datetime, timedelta
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

        # 2. Enforce AI Daily Limit for Free Tier Users
        current_ai_usage = getattr(current_user, "ai_usage_count", 0)
        if not is_premium_or_admin and current_ai_usage >= FREE_TIER_DAILY_AI_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"You have reached your daily limit of "
                    f"{FREE_TIER_DAILY_AI_LIMIT} AI explanations."
                ),
            )

        # 3. Get AI Client
        client = get_groq_client()
        if not client:
            logger.warning("Groq client not available")
            return {
                "explanation": "AI explanation is temporarily unavailable. Please try again in a moment.",
                "is_mock": True,
            }

        # 4. Construct Prompt (short, structured, no preamble)
        system_instruction = (
            "You are a concise CS tutor writing exam explanations for university students. "
            "Rules:\n"
            "- Total response: 100-150 words. Do not exceed 150 words.\n"
            "- No preamble. Do NOT start with 'Great question' or 'Let me explain'.\n"
            "- Use simple Markdown. One code block only if truly needed.\n"
            "- Prioritize clarity over completeness."
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

If the student picked wrong, add ONE short sentence inside the first section noting their likely mistake. Do NOT explain every wrong option."""

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": initial_prompt},
        ]

        # 5. Try Groq models in order
        groq_models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]
        ai_explanation = None

        for model in groq_models:
            try:
                logger.info(f"Trying Groq model: {model}")
                completion = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=350,
                )
                ai_explanation = completion.choices[0].message.content
                if ai_explanation and ai_explanation.strip():
                    logger.info(f"Success with model: {model}")
                    break
            except Exception as e:
                logger.warning(f"Model {model} failed: {e}")
                continue

        # 6. Increment usage count for free users
        if not is_premium_or_admin and ai_explanation:
            current_user.ai_usage_count += 1
            current_user.last_ai_usage_date = datetime.utcnow()
            db.commit()

        # 7. Return result
        if ai_explanation and ai_explanation.strip():
            return {
                "explanation": ai_explanation,
                "is_mock": False,
            }
        else:
            return {
                "explanation": "Explanation not available. Please try again later.",
                "is_mock": True,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Explain question error: {e}")
        return {
            "explanation": "Explanation not available. Please try again later.",
            "is_mock": True,
        }