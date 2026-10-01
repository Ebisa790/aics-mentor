import json
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.core.ai_client import get_groq_client
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.api.deps import get_current_user
from app.models.conversation import AIConversation, AIMessage, MessageRole, TutorMode
from app.models.course import Course
from app.models.user import User
from app.schemas.conversation import ChatRequest, ChatResponse, ConversationOut, ConversationDetailOut, MessageOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tutor", tags=["tutor"])

MODE_INSTRUCTIONS = {
    TutorMode.BEGINNER: (
        "Explain in the simplest possible terms, as if to someone encountering this for the "
        "first time. Use one everyday analogy before introducing technical vocabulary. "
        "Target length: 150-250 words."
    ),
    TutorMode.ADVANCED: (
        "Give a technical, exam-level explanation: precise definition, algorithms or code if "
        "relevant, edge cases, and how this tends to appear in the Ethiopian CS exit exam. "
        "Target length: 350-500 words."
    ),
    TutorMode.EXPLANATION: (
        "Explain clearly: definition, one concrete example, and how it connects to the wider "
        "course. Balance rigor with clarity. Target length: 250-400 words."
    ),
}


def _sse_event(payload: dict) -> str:
    """Format a dict as a single Server-Sent Event message."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _build_system_prompt(user: User, course: Course | None, mode: TutorMode) -> str:
    """Builds the tutor's system prompt tailored to the active course or full MoE syllabus."""
    base = (
        f"You are the AI tutor inside AI-CS Mentor, helping {user.full_name} prepare for the "
        "Ethiopian Ministry of Education Computer Science Exit Exam.\n"
        f"Mode: {MODE_INSTRUCTIONS[mode]}\n\n"
        "STRICT RESPONSE RULES — follow all of them:\n"
        "- Stay within the target word range above. Absolute maximum: 500 words.\n"
        "- No preamble, no greeting, no 'Great question'. Start directly with the answer.\n"
        "- Use short Markdown: bold labels, bullets, or a compact table. At most one code block if truly needed.\n"
        "- Give ONE concrete example, not three. Skip 'this may appear on the exam' commentary unless the student asks.\n"
        "- If the topic needs more than the word limit, cover the essential idea and end with: "
        "'Ask me to go deeper on any part.'\n\n"
        "Ground answers in correct BSc-level CS content. If unsure about a fact, say so briefly instead "
        "of padding the answer."
    )

    if course is None:
        return base + (
            "\n\nNo specific course is selected. If the question is broad, answer it briefly and "
            "suggest the student pick a course from the dropdown for a more focused explanation."
        )

    course_title = getattr(course, "title", getattr(course, "name", "Course"))
    code_line = f"- Course code: {course.code}\n" if getattr(course, "code", None) else ""
    description_line = f"- Focus: {course.description}\n" if getattr(course, "description", None) else ""
    
    return base + (
        "\n\n--- Active course ---\n"
        f"- {course_title}"
        f"{(' (' + course.code + ')') if getattr(course, 'code', None) else ''}\n"
        f"- Category: {getattr(course, 'category', 'CS Core')}\n"
        f"Tailor the answer to the scope of {course_title}."
    )


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
def chat(
    request: Request, 
    payload: ChatRequest, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Premium gating: Free users get limited AI tutor access
    from app.models.user import SubscriptionTier, UserRole
    is_premium_or_admin = (
        current_user.subscription_tier == SubscriptionTier.PREMIUM
        or current_user.role == UserRole.ADMIN
    )
    if not is_premium_or_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Study Assistant is a Premium feature. Please upgrade to continue."
        )

    client = get_groq_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="AI tutor is not configured (missing GROQ_API_KEY)"
        )

    try:
        # 1. Resolve active course
        course = None
        if payload.course_id:
            course = db.get(Course, payload.course_id)
            if not course:
                raise HTTPException(status_code=404, detail="Course not found")

        # 2. Find or create conversation thread
        if payload.conversation_id:
            conversation = db.get(AIConversation, payload.conversation_id)
            if not conversation or conversation.student_id != current_user.id:
                raise HTTPException(status_code=404, detail="Conversation not found")
            if course and not conversation.course_id:
                conversation.course_id = course.id
        else:
            conversation = AIConversation(
                student_id=current_user.id,
                course_id=course.id if course else None,
                title=payload.message[:80],
            )
            db.add(conversation)
            db.flush()

        # Update conversation activity timestamp
        conversation.updated_at = datetime.now(timezone.utc)

        # 3. Save student's message
        user_message = AIMessage(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=payload.message,
            mode=payload.mode,
        )
        db.add(user_message)
        db.flush()

        # 4. Pull recent message window (latest 20 messages)
               # 4. Pull recent message window.
        # 6 = current user message + ~2.5 rounds of prior chat.
        # Sending fewer tokens keeps us under Groq's free-tier TPM cap.
        history_desc = (
            db.query(AIMessage)
            .filter(AIMessage.conversation_id == conversation.id)
            .order_by(AIMessage.created_at.desc())
            .limit(6)
            .all()
        )
        history = list(reversed(history_desc))

        system_prompt = _build_system_prompt(current_user, course, payload.mode)
        groq_messages = [{"role": "system", "content": system_prompt}]
        groq_messages += [
            {"role": "user" if m.role == MessageRole.USER else "assistant", "content": m.content} 
            for m in history
        ]

        # 5. Request completion from Groq API with model fallback
        groq_models = [
            "qwen/qwen3.6-27b",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "allam-2-7b"
        ]
        
        reply_text = None
        for model_name in groq_models:
            try:
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=groq_messages,
                    temperature=0.5,
                    max_tokens=1000,
                )
                reply_text = completion.choices[0].message.content
                if reply_text and reply_text.strip():
                    logger.info(f"Tutor using model: {model_name}")
                    break
            except Exception as e:
                logger.warning(f"Tutor model {model_name} failed: {e}")
                continue
        
        if not reply_text:
            raise Exception("All Groq models failed for tutor")
        
        # Clean the response - remove thinking blocks
        import re
        reply_text = re.sub(r'<think>[\s\S]*?</think>', '', reply_text, flags=re.IGNORECASE)
        reply_text = re.sub(r'</?think>', '', reply_text, flags=re.IGNORECASE)
        reply_text = reply_text.strip()

        # 6. Save assistant reply & update AI usage metrics
        assistant_message = AIMessage(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=reply_text,
            mode=payload.mode,
        )
        db.add(assistant_message)
        
        # Increment user AI usage metric
        current_user.ai_usage_count = (current_user.ai_usage_count or 0) + 1

        db.commit()
        db.refresh(assistant_message)

        return ChatResponse(
            conversation_id=conversation.id, 
            reply=MessageOut.model_validate(assistant_message)
        )

    except HTTPException:
        raise
    except Exception:
        logger.error("Tutor chat request failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, 
            detail="The AI tutor couldn't process that request. Please try again."
        )


# -------------------------------------------------------------------
# Streaming variant of /chat (SSE)
# -------------------------------------------------------------------

@router.post("/chat/stream")
@limiter.limit("30/minute")
def chat_stream(
    request: Request,
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE streaming variant of /chat.

    Events:
      - {"type":"meta", "conversation_id": "..."}
      - {"type":"delta", "text": "..."}   (repeated)
      - {"type":"done", "conversation_id":"...", "reply": {...MessageOut...}}
      - {"type":"error", "detail": "..."}
    """
    from app.models.user import SubscriptionTier, UserRole

    is_premium_or_admin = (
        current_user.subscription_tier == SubscriptionTier.PREMIUM
        or current_user.role == UserRole.ADMIN
    )
    if not is_premium_or_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Study Assistant is a Premium feature. Please upgrade to continue.",
        )

    client = get_groq_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI tutor is not configured (missing GROQ_API_KEY)",
        )

    # --- Same conversation setup as /chat ---
    course = None
    if payload.course_id:
        course = db.get(Course, payload.course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

    if payload.conversation_id:
        conversation = db.get(AIConversation, payload.conversation_id)
        if not conversation or conversation.student_id != current_user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if course and not conversation.course_id:
            conversation.course_id = course.id
    else:
        conversation = AIConversation(
            student_id=current_user.id,
            course_id=course.id if course else None,
            title=payload.message[:80],
        )
        db.add(conversation)
        db.flush()

    conversation.updated_at = datetime.now(timezone.utc)

    user_message = AIMessage(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=payload.message,
        mode=payload.mode,
    )
    db.add(user_message)
    db.flush()

    # Send only the last 6 messages (current user msg + ~2.5 prior rounds).
    # See /chat for the token-budget reasoning.
    history_desc = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation.id)
        .order_by(AIMessage.created_at.desc())
        .limit(6)
        .all()
    )
    history = list(reversed(history_desc))

    system_prompt = _build_system_prompt(current_user, course, payload.mode)
    groq_messages = [{"role": "system", "content": system_prompt}]
    groq_messages += [
        {"role": "user" if m.role == MessageRole.USER else "assistant", "content": m.content}
        for m in history
    ]

    # Capture values we need inside the generator (avoid late-binding surprises)
    conversation_id = conversation.id
    user_id = current_user.id
    mode = payload.mode

    def event_generator():
        # Emit meta first so frontend has the conversation id immediately
        yield _sse_event({"type": "meta", "conversation_id": str(conversation_id)})

        groq_models = [
            "qwen/qwen3.6-27b",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "allam-2-7b",
        ]
        accumulated = ""

        for model_name in groq_models:
            try:
                stream = client.chat.completions.create(
                    model=model_name,
                    messages=groq_messages,
                    temperature=0.5,
                    max_tokens=1000,
                    stream=True,
                )
                started = False
                for chunk in stream:
                    try:
                        delta = chunk.choices[0].delta.content or ""
                    except (IndexError, AttributeError):
                        delta = ""
                    if delta:
                        started = True
                        accumulated += delta
                        yield _sse_event({"type": "delta", "text": delta})
                if started:
                    logger.info(f"Tutor streaming using model: {model_name}")
                    break
            except Exception as e:
                logger.warning(f"Tutor stream {model_name} failed: {e}")
                continue

        if not accumulated.strip():
            yield _sse_event({"type": "error", "detail": "All AI models failed."})
            return

        # Strip think blocks (same as /chat)
        reply_text = re.sub(r"<think>[\s\S]*?</think>", "", accumulated, flags=re.IGNORECASE)
        reply_text = re.sub(r"</?think>", "", reply_text, flags=re.IGNORECASE).strip()

        # Persist assistant message AFTER streaming completes
        try:
            assistant_message = AIMessage(
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=reply_text,
                mode=mode,
            )
            db.add(assistant_message)

            # Increment user AI usage metric
            user_row = db.get(User, user_id)
            if user_row is not None:
                user_row.ai_usage_count = (user_row.ai_usage_count or 0) + 1

            db.commit()
            db.refresh(assistant_message)

            yield _sse_event({
                "type": "done",
                "conversation_id": str(conversation_id),
                "reply": MessageOut.model_validate(assistant_message).model_dump(mode="json"),
            })
        except Exception as e:
            logger.error(f"Failed to persist tutor assistant message: {e}", exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass
            yield _sse_event({"type": "error", "detail": "Failed to save response."})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(AIConversation)
        .filter(AIConversation.student_id == current_user.id)
        .order_by(AIConversation.updated_at.desc())
        .all()
    )

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify the conversation exists and belongs to the authenticated student
    conversation = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.student_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    db.delete(conversation)
    db.commit()
    return None


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(
    conversation_id: uuid.UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    conversation = (
        db.query(AIConversation)
        .options(joinedload(AIConversation.messages))
        .filter(AIConversation.id == conversation_id)
        .first()
    )
    if not conversation or conversation.student_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    return conversation