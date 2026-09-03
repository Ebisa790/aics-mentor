import csv
import io
import json
import logging
import os
import uuid
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone 
from sqlalchemy.ext.asyncio import AsyncSession
from celery.result import AsyncResult
from app.core.celery_app import celery_app
from fastapi import APIRouter, Depends, File, Form, status, HTTPException, Request, UploadFile, Query
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.tasks.master_takes import process_master_booklet_task
from app.api.deps import require_admin
from app.core.ai_client import DEFAULT_MODEL, get_groq_client
from app.core.database import get_db
from app.core.rate_limit import limiter
from sqlalchemy import delete, func
from app.models.course import Course
from sqlalchemy import text, select, delete
from app.models.course_material import CourseMaterial
from app.models.exam_question import ExamQuestionResponse
from app.models.exam_question import ExamDifficulty, ExamQuestion, ReviewStatus
from app.models.quiz import DifficultyLevel, Question, QuestionType
from app.models.user import User
from app.schemas.admin import (
    AIGenerateRequest,
    AIGenerateResponse,
    AINoteDraft,
    AIQuestionDraft,
    BulkImportResult,
    BulkQuestionRow,
    CourseMaterialOut,
    CourseMaterialUpdate,
    ExamQuestionCreate,
    ExamQuestionOut,
    ExamQuestionUpdate,
    ReviewAction,
)

logger = logging.getLogger(__name__)

# Main router definition with prefix and admin dependency
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


class BatchReviewRequest(BaseModel):
    question_ids: list[str]
    action: str  # 'approve' or 'reject'


class BulkApproveRequest(BaseModel):
    question_ids: list[str]


class BulkDeleteRequest(BaseModel):
    ids: List[str]


class DuplicateGroupResponse(BaseModel):
    normalized_text: str
    count: int
    questions: list[ExamQuestionOut]


def _get_course_or_404(db: Session, course_id: uuid.UUID) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _extract_text_universal(file_path: str, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF file: {str(e)}")
    elif ext in (".docx", ".doc"):
        try:
            import docx
            doc = docx.Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Word document: {str(e)}")
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()


# ============================== Admin Analytics Dashboard ==============================

@router.get("/analytics")
def get_analytics_dashboard(db: Session = Depends(get_db)):
    """Returns comprehensive analytics for admin dashboard."""
    from sqlalchemy import func as sql_func
    from datetime import datetime, timedelta
    
    db.rollback()  # Reset any failed transaction
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    
    total_users = db.query(User).count()
    premium_users = db.query(User).filter(User.subscription_tier == 'premium').count()
    
    # Active users (last_active within 7 days)
    active_users_week = db.query(User).filter(User.last_active >= week_ago).count()
    active_users_today = db.query(User).filter(User.last_active >= now.replace(hour=0, minute=0, second=0)).count()
    free_users = db.query(User).filter(User.subscription_tier == 'free').count()
    new_users_week = db.query(User).filter(User.created_at >= week_ago).count()
    active_users_week = 0
    if hasattr(User, 'last_active'):
        active_users_week = db.query(User).filter(User.last_active >= week_ago).count()
    
    total_courses = db.query(Course).count()
    total_questions = db.query(Question).count()
    total_materials = db.query(CourseMaterial).count()
    
    from app.models.course import CourseNotes
    total_notes = db.query(CourseNotes).count()
    approved_notes = db.query(CourseNotes).filter(CourseNotes.status == 'APPROVED').count()
    draft_notes = db.query(CourseNotes).filter(CourseNotes.status == 'DRAFT').count()
    rejected_notes = db.query(CourseNotes).filter(CourseNotes.status == 'REJECTED').count()
    
    try:
        from app.models.flashcard import Flashcard
        total_flashcards = db.query(Flashcard).count()
        approved_flashcards = db.query(Flashcard).filter(Flashcard.status == 'APPROVED').count()
    except ImportError:
        total_flashcards = 0
        approved_flashcards = 0
    
    try:
        from app.models.attempt import Attempt, DrillAttempt
        total_quiz_attempts = db.query(Attempt).count()
        total_drill_attempts = db.query(DrillAttempt).count()
    except ImportError:
        total_quiz_attempts = 0
        total_drill_attempts = 0
    
    total_revenue = 0
    revenue_week = 0
    total_payments = 0
    payments_week = 0
    try:
        from app.models.payment import Payment
        total_revenue = db.query(sql_func.sum(Payment.amount)).filter(Payment.status == 'success').scalar() or 0
        revenue_week = db.query(sql_func.sum(Payment.amount)).filter(
            Payment.status == 'success',
            Payment.created_at >= week_ago
        ).scalar() or 0
    except Exception as e:
        db.rollback()  # IMPORTANT: Rollback failed transaction
        pass
    
    low_coverage_courses = []
    notes_with_coverage = db.query(CourseNotes).filter(CourseNotes.coverage_score.isnot(None)).all()
    for note in notes_with_coverage:
        if note.coverage_score and note.coverage_score < 70:
            course = db.get(Course, note.course_id)
            if course:
                low_coverage_courses.append({
                    "course_name": course.name,
                    "coverage": note.coverage_score
                })
    
    pending_questions = 0
    if hasattr(Question, 'review_status'):
        pending_questions = db.query(Question).filter(
            Question.review_status.in_(['generated', 'under_review'])
        ).count()
    
    popular_courses = []
    try:
        results = db.query(
            Course.name,
            Course.code,
            func.count(Question.id).label('question_count')
        ).outerjoin(Question, Course.id == Question.course_id)\
         .group_by(Course.id, Course.name, Course.code)\
         .order_by(func.count(Question.id).desc())\
         .limit(5)\
         .all()
        
        popular_courses = [
            {"name": r.name, "code": r.code, "question_count": r.question_count}
            for r in results
        ]
    except Exception:
        pass
    
    return {
        "user_stats": {
            "total_users": total_users,
            "active_users_week": active_users_week,
            "active_users_today": active_users_today,
            "premium_users": premium_users,
            "free_users": free_users,
            "new_users_week": new_users_week,
            "conversion_rate": round((premium_users / total_users) * 100, 1) if total_users > 0 else 0
        },
        "content_stats": {
            "total_courses": total_courses,
            "total_questions": total_questions,
            "total_materials": total_materials,
            "total_notes": total_notes,
            "approved_notes": approved_notes,
            "draft_notes": draft_notes,
            "rejected_notes": rejected_notes,
            "total_flashcards": total_flashcards,
            "approved_flashcards": approved_flashcards
        },
        "engagement_stats": {
            "total_quiz_attempts": total_quiz_attempts,
            "total_drill_attempts": total_drill_attempts,
            "total_attempts": total_quiz_attempts + total_drill_attempts
        },
        "revenue_stats": {
            "total_revenue": float(total_revenue),
            "total_payments": total_payments,
            "payments_week": payments_week,
            "revenue_week": float(revenue_week)
        },
        "alerts": {
            "low_coverage_courses": low_coverage_courses,
            "pending_review_count": pending_questions,
            "draft_notes_count": draft_notes
        },
        "popular_courses": popular_courses
    }


# ============================== Question Coverage Report ==============================

@router.get("/question-coverage")
def get_question_coverage(db: Session = Depends(get_db)):
    """Returns question bank coverage report - course breakdown and difficulty distribution."""
    from app.models.course import Course
    from sqlalchemy import func as sql_func
    
    # Course breakdown
    course_stats = db.query(
        Course.name,
        Course.code,
        func.count(Question.id).label('question_count')
    ).outerjoin(Question, Course.id == Question.course_id)\
     .group_by(Course.id, Course.name, Course.code)\
     .order_by(func.count(Question.id))\
     .all()
    
    courses = []
    for c in course_stats:
        target = 100  # Target questions per course
        count = c.question_count or 0
        
        if count < 20:
            status = 'CRITICAL'
        elif count < 80:
            status = 'WARNING'
        elif count < 100:
            status = 'NEAR_TARGET'
        else:
            status = 'GOOD'
        
        courses.append({
            "name": c.name,
            "code": c.code,
            "question_count": count,
            "target": target,
            "gap": max(0, target - count),
            "status": status
        })
    
    # Difficulty breakdown
    easy_count = db.query(Question).filter(Question.difficulty == 'beginner').count()
    medium_count = db.query(Question).filter(Question.difficulty == 'intermediate').count()
    hard_count = db.query(Question).filter(Question.difficulty == 'advanced').count()
    
    total = easy_count + medium_count + hard_count
    
    # Target distribution (30% easy, 50% medium, 20% hard)
    target_easy = int(total * 0.30)
    target_medium = int(total * 0.50)
    target_hard = int(total * 0.20)
    
    difficulty = {
        "easy": {
            "count": easy_count,
            "target": target_easy,
            "gap": max(0, target_easy - easy_count),
            "percentage": round((easy_count / total) * 100, 1) if total > 0 else 0
        },
        "medium": {
            "count": medium_count,
            "target": target_medium,
            "gap": max(0, target_medium - medium_count),
            "percentage": round((medium_count / total) * 100, 1) if total > 0 else 0
        },
        "hard": {
            "count": hard_count,
            "target": target_hard,
            "gap": max(0, target_hard - hard_count),
            "percentage": round((hard_count / total) * 100, 1) if total > 0 else 0
        }
    }
    
    return {
        "total_questions": total,
        "courses": courses,
        "difficulty": difficulty,
        "critical_courses": [c for c in courses if c['status'] == 'CRITICAL'],
        "warning_courses": [c for c in courses if c['status'] == 'WARNING']
    }


# ============================== Admin Dashboard Stats ==============================
@router.get("/revenue-stats")
def get_revenue_stats(db: Session = Depends(get_db)):
    """Returns revenue analytics for admin dashboard."""
    from app.models.payment import Payment, PaymentStatus
    from sqlalchemy import func as sql_func
    
    # Revenue metrics
    total_payments = db.query(Payment).filter(Payment.status == PaymentStatus.SUCCESS).count()
    total_revenue = db.query(sql_func.sum(Payment.amount)).filter(Payment.status == PaymentStatus.SUCCESS).scalar() or 0
    
    # Premium users
    premium_users = db.query(User).filter(User.subscription_tier == "premium").count()
    
    # Free users
    free_users = db.query(User).filter(User.subscription_tier == "free").count()
    
    # Recent payments
    recent_payments = (
        db.query(Payment)
        .filter(Payment.status == PaymentStatus.SUCCESS)
        .order_by(Payment.created_at.desc())
        .limit(10)
        .all()
    )
    
    # Monthly revenue (last 6 months)
    from datetime import datetime, timedelta
    monthly_revenue = []
    for i in range(5, -1, -1):
        month_start = datetime.utcnow().replace(day=1) - timedelta(days=30*i)
        month_end = (month_start + timedelta(days=31)).replace(day=1)
        month_revenue = (
            db.query(sql_func.sum(Payment.amount))
            .filter(
                Payment.status == PaymentStatus.SUCCESS,
                Payment.created_at >= month_start,
                Payment.created_at < month_end,
            )
            .scalar() or 0
        )
        monthly_revenue.append({
            "month": month_start.strftime("%b %Y"),
            "revenue": float(month_revenue),
        })
    
    return {
        "total_revenue": float(total_revenue),
        "total_payments": total_payments,
        "premium_users": premium_users,
        "free_users": free_users,
        "conversion_rate": round((premium_users / (premium_users + free_users)) * 100, 2) if (premium_users + free_users) > 0 else 0,
        "monthly_revenue": monthly_revenue,
        "recent_payments": [
            {
                "id": str(p.id),
                "user_email": db.query(User).filter(User.id == p.user_id).first().email if db.query(User).filter(User.id == p.user_id).first() else "Unknown",
                "amount": float(p.amount),
                "currency": p.currency,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in recent_payments
        ]
    }


@router.get("/stats")
def get_admin_dashboard_stats(db: Session = Depends(get_db)):
    """Returns overall database counts and per-course question metrics."""
    total_questions = db.query(Question).count()
    total_courses = db.query(Course).count()
    total_users = db.query(User).count()

    # Aggregate question counts per course
    course_breakdown = db.query(
        Course.id,
        Course.code,
        Course.name,
        func.count(Question.id).label("question_count")
    ).outerjoin(Question, Course.id == Question.course_id)\
     .group_by(Course.id, Course.code, Course.name)\
     .all()

    return {
        "total_questions": total_questions,
        "total_courses": total_courses,
        "total_users": total_users,
        "courses": [
            {
                "course_id": str(row.id),
                "code": row.code,
                "name": row.name,
                "question_count": row.question_count
            }
            for row in course_breakdown
        ]
    }


# ============================== Course materials ==============================

@router.get("/courses/{course_id}/materials", response_model=list[CourseMaterialOut])
def list_materials(course_id: uuid.UUID, db: Session = Depends(get_db)):
    _get_course_or_404(db, course_id)
    return (
        db.query(CourseMaterial)
        .filter(CourseMaterial.course_id == course_id)
        .order_by(CourseMaterial.created_at.desc())
        .all()
    )


@router.post("/courses/{course_id}/materials", response_model=CourseMaterialOut, status_code=201)
async def create_material(
    course_id: uuid.UUID,
    file: UploadFile = File(...),
    title: str = Form(...),
    material_type: str = Form("note"),
    is_ai_generated: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload a material file for a course."""
    _get_course_or_404(db, course_id)
    
    # Read file content
    file_content = await file.read()
    
    # Try to decode as text
    try:
        content = file_content.decode('utf-8')
    except UnicodeDecodeError:
        # For binary files (PDF, DOCX), try latin-1 or replace
        try:
            content = file_content.decode('latin-1')
        except:
            content = file_content.decode('utf-8', errors='replace')
    
    # Remove NUL characters that cause PostgreSQL errors
    content = content.replace('\x00', '')
    content = content.replace('\u0000', '')
    # Also remove any other problematic characters
    import re
    content = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', content)
    
    # Truncate content for AI processing (Groq 8000 token limit)
    # 25000 chars ≈ 6000 tokens (safely under limit)
    if len(content) > 25000:
        content = content[:25000]
    
    material = CourseMaterial(
        course_id=course_id,
        created_by_id=current_user.id,
        title=title,
        content=content,
        material_type=material_type,
        is_ai_generated=is_ai_generated,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.put("/materials/{material_id}", response_model=CourseMaterialOut)
def update_material(material_id: uuid.UUID, payload: CourseMaterialUpdate, db: Session = Depends(get_db)):
    material = db.get(CourseMaterial, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(material, field, value)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/materials/{material_id}", status_code=204)
def delete_material(material_id: uuid.UUID, db: Session = Depends(get_db)):
    material = db.get(CourseMaterial, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    db.commit()


# ============================== Exam questions (QA workflow) ==============================

_DIFFICULTY_MAP: dict[ExamDifficulty, DifficultyLevel] = {
    ExamDifficulty.EASY: DifficultyLevel.BEGINNER,
    ExamDifficulty.MEDIUM: DifficultyLevel.INTERMEDIATE,
    ExamDifficulty.HARD: DifficultyLevel.ADVANCED,
}


 

from datetime import datetime, timezone

def _promote_to_question(db: Session, exam_question: ExamQuestion) -> Question:
    now_utc = datetime.now(timezone.utc)
    question = Question(
        course_id=exam_question.course_id,
        question_type=QuestionType.MULTIPLE_CHOICE,
        difficulty=_DIFFICULTY_MAP[exam_question.difficulty],
        prompt=exam_question.question_text,
        choices={
            "A": exam_question.option_a,
            "B": exam_question.option_b,
            "C": exam_question.option_c,
            "D": exam_question.option_d,
        },
        correct_answer=exam_question.correct_option,
        explanation=exam_question.explanation,
        created_at=now_utc,
    )
    db.add(question)
    db.flush()
    exam_question.promoted_question_id = question.id
    return question


@router.get("/courses/{course_id}/questions", response_model=list[ExamQuestionOut])
def list_questions(course_id: uuid.UUID, status: str | None = Query(None), db: Session = Depends(get_db)):
    _get_course_or_404(db, course_id)
    query = db.query(ExamQuestion).filter(ExamQuestion.course_id == course_id)
    
    if status:
        try:
            enum_status = ReviewStatus(status.upper())
            query = query.filter(ExamQuestion.review_status == enum_status)
        except ValueError:
            pass
            
    return query.order_by(ExamQuestion.created_at.desc()).all()


@router.post("/courses/{course_id}/questions", response_model=ExamQuestionOut, status_code=201)
def create_question(
    course_id: uuid.UUID,
    payload: ExamQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _get_course_or_404(db, course_id)
    data = payload.model_dump()

    question = ExamQuestion(course_id=course_id, created_by_id=current_user.id, **data)

    if payload.is_ai_generated:
        question.review_status = ReviewStatus.GENERATED
        question.ai_model = DEFAULT_MODEL
    else:
        question.review_status = ReviewStatus.APPROVED
        question.reviewed_by_id = current_user.id
        question.reviewed_at = datetime.utcnow()

    db.add(question)
    db.flush()

    if question.review_status == ReviewStatus.APPROVED:
        _promote_to_question(db, question)

    db.commit()
    db.refresh(question)
    return question


@router.put("/questions/{question_id}", response_model=ExamQuestionOut)
def update_question(
    question_id: uuid.UUID,
    payload: ExamQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    question = db.get(ExamQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if question.review_status in (ReviewStatus.APPROVED, ReviewStatus.REJECTED, ReviewStatus.ARCHIVED):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot edit a question that's already {question.review_status.value}. "
                "Archive it and create a fresh draft instead."
            ),
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    if question.review_status == ReviewStatus.GENERATED:
        question.review_status = ReviewStatus.UNDER_REVIEW

    db.commit()
    db.refresh(question)
    return question


HYBRID_GENERATION_PROMPT = """
You are an expert Computer Science curriculum analyzer and exam item writer for the Ethiopian Ministry of Education CS Exit Exam.
You are given source material text and a target question count of {target_count}.

Your instructions:
1. FIRST, scan the text and extract all explicit multiple-choice questions found within it. Tag these items with source_type: "extracted".
2. SECOND, if the number of extracted questions is less than the target count ({target_count}), analyze the core themes, definitions, and notes in the remaining text to synthesize brand-new, high-quality multiple-choice questions (source_type: "generated") until the total count matches the target.
3. Every question must have four options (A-D), exactly one correct option ("A", "B", "C", or "D"), and a clear explanation.

Return a JSON object with a key "questions" containing an array of objects with these exact keys:
- "question_text": (string)
- "option_a": (string)
- "option_b": (string)
- "option_c": (string)
- "option_d": (string)
- "correct_option": (string, strictly "A", "B", "C", or "D")
- "explanation": (string)
- "source_type": (string, either "extracted" or "generated")
"""


MASTER_HYBRID_PROMPT = """
You are an expert Computer Science curriculum analyzer and exam item writer for the Ethiopian Ministry of Education CS Exit Exam.
You are given source material text from a multi-course master booklet and a target question count of {target_count}.

Available Courses:
{courses_list_str}

Your instructions:
1. FIRST, scan the text and extract explicit multiple-choice questions found within it. Tag these items with source_type: "extracted".
2. SECOND, if the number of extracted questions is less than {target_count}, analyze the core themes to synthesize brand-new, high-quality multiple-choice questions (source_type: "generated") until the total count matches the target.
3. Every question MUST be mapped to one of the valid course codes provided above.
4. Every question must have four options (A-D), exactly one correct option ("A", "B", "C", or "D"), and a clear explanation.

Return a JSON object with a key "questions" containing an array of objects with these exact keys:
- "course_code": (string, matching one of the provided course codes above)
- "question_text": (string)
- "option_a": (string)
- "option_b": (string)
- "option_c": (string)
- "option_d": (string)
- "correct_option": (string, strictly "A", "B", "C", or "D")
- "explanation": (string)
- "source_type": (string, either "extracted" or "generated")
"""

@router.post("/courses/{course_id}/materials/hybrid-generate", response_model=dict)
async def hybrid_generate_questions_from_material(
    course_id: uuid.UUID,
    target_count: int = 20,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    course = _get_course_or_404(db, course_id)
    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI drafting is not configured (missing GROQ_API_KEY)")

    file_bytes = await file.read()
    temp_filename = f"temp_{uuid.uuid4()}{os.path.splitext(file.filename or '')[1]}"
    with open(temp_filename, "wb") as f:
        f.write(file_bytes)
    
    try:
        raw_text = _extract_text_universal(temp_filename, file.filename or "doc.txt")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded file: {str(e)}")
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="The uploaded file contained no readable text.")

    trimmed_text = raw_text[:12000]
    formatted_prompt = HYBRID_GENERATION_PROMPT.format(target_count=target_count)
    
    try:
        completion = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": formatted_prompt},
                {"role": "user", "content": f"Source Material:\n\n{trimmed_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=4000,
        )
        content = completion.choices[0].message.content
        data = json.loads(_strip_code_fences(content))
        
        # --- BULLETPROOF JSON KEY AUTO-DETECTION ---
        questions_data = []
        if isinstance(data, list):
            questions_data = data
        elif isinstance(data, dict):
            # Check common key alternatives used by LLMs
            for key in ["questions", "exam_questions", "items", "data", "results", "questions_list"]:
                if key in data and isinstance(data[key], list):
                    questions_data = data[key]
                    break
            # Fallback: grab the first list found in the JSON object dictionary
            if not questions_data:
                for val in data.values():
                    if isinstance(val, list):
                        questions_data = val
                        break
        # -------------------------------------------

    except Exception as exc:
        logger.warning("Hybrid AI generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"The AI failed to process the material into questions: {str(exc)}")

    created_staging_questions = []
    for q_data in questions_data:
        if not isinstance(q_data, dict):
            continue
            
        correct_opt = (q_data.get("correct_option") or "A").upper()
        if correct_opt not in ["A", "B", "C", "D"]:
            correct_opt = "A"

        exam_q = ExamQuestion(
            course_id=course.id,
            created_by_id=current_user.id,
            question_text=q_data.get("question_text") or q_data.get("text") or "Untitled Question",
            option_a=q_data.get("option_a") or q_data.get("a"),
            option_b=q_data.get("option_b") or q_data.get("b"),
            option_c=q_data.get("option_c") or q_data.get("c"),
            option_d=q_data.get("option_d") or q_data.get("d"),
            correct_option=correct_opt,
            explanation=q_data.get("explanation"),
            difficulty=ExamDifficulty.MEDIUM,
            review_status=ReviewStatus.GENERATED,
            is_ai_generated=True,
            ai_model=DEFAULT_MODEL,
        )
        db.add(exam_q)
        created_staging_questions.append(exam_q)

    db.commit()
    
    # Safe fallback counts so they reflect actual staged questions if source_type is omitted
    extracted_cnt = sum(1 for q in questions_data if isinstance(q, dict) and q.get("source_type") == "extracted")
    generated_cnt = sum(1 for q in questions_data if isinstance(q, dict) and q.get("source_type") == "generated")
    if extracted_cnt == 0 and generated_cnt == 0:
        generated_cnt = len(created_staging_questions)

    return {
        "status": "success",
        "message": f"Successfully parsed material and staged {len(created_staging_questions)} questions for review.",
        "extracted_count": extracted_cnt,
        "ai_generated_count": generated_cnt,
        "total_staged": len(created_staging_questions)
    }

@router.post("/courses/{course_id}/materials/hybrid-generate", status_code=status.HTTP_202_ACCEPTED)
async def hybrid_generate_specific_course_questions(
    course_id: uuid.UUID,
    target_count: int = Query(20, ge=5, le=100),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # 1. Verify the course exists immediately
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    filename = file.filename or "material.txt"
    file_bytes = await file.read()
    
    # 2. Save file temporarily for Celery worker access
    temp_filename = f"specific_course_{uuid.uuid4()}{os.path.splitext(filename)[1]}"
    try:
        with open(temp_filename, "wb") as f:
            f.write(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save temp file: {str(exc)}")

    try:
        # 3. Dispatch to Celery background worker with single_course_id
        task = process_master_booklet_task.delay(
            file_path=os.path.abspath(temp_filename),
            filename=filename,
            target_count=target_count,
            admin_user_id=str(current_user.id),
            single_course_id=str(course.id)  # Locks it down to this course only
        )
    except Exception as exc:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=503, detail=f"Failed to queue background task: {str(exc)}")

    return {
        "status": "accepted",
        "task_id": task.id,
        "message": f"Material queued for course {course.code}. Processing in background."
    }


@router.post("/materials/master-hybrid-generate", response_model=dict, status_code=202)
async def master_multi_course_hybrid_generate(
    target_count: int = Query(100, ge=10, le=500),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    filename = file.filename or "master_booklet.txt"
    file_bytes = await file.read()
    temp_filename = f"master_temp_{uuid.uuid4()}{os.path.splitext(filename)[1]}"
    
    try:
        with open(temp_filename, "wb") as f:
            f.write(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save temporary file: {str(exc)}")

    try:
        task = process_master_booklet_task.delay(
            file_path=os.path.abspath(temp_filename),
            filename=filename,
            target_count=target_count,
            admin_user_id=str(current_user.id)
        )
    except Exception as exc:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=503, detail=f"Failed to dispatch background task to Celery/Redis: {str(exc)}")

    return {
        "status": "accepted",
        "task_id": task.id,
        "message": "Master booklet upload accepted and queued for background processing."
    }


@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    
    # Safely handle exception serialization if task failed
    result_data = task_result.result
    if task_result.status == "FAILURE" and isinstance(result_data, Exception):
        result_data = {"error": str(result_data)}

    response_data = {
        "status": task_result.status,
        "result": result_data if task_result.ready() else None
    }
    
    if task_result.state == "PROGRESS" and task_result.info:
        response_data["meta"] = task_result.info
        
    return response_data


@router.patch("/questions/{question_id}/review", response_model=ExamQuestionOut)
def review_question(
    question_id: uuid.UUID,
    payload: ReviewAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    question = db.get(ExamQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if payload.action in ("approve", "reject"):
        if question.review_status not in (ReviewStatus.GENERATED, ReviewStatus.UNDER_REVIEW):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot {payload.action} a question that's already {question.review_status.value}.",
            )
        question.reviewed_by_id = current_user.id
        question.reviewed_at = datetime.utcnow()

        if payload.action == "approve":
            question.review_status = ReviewStatus.APPROVED
            _promote_to_question(db, question)
        else:
            question.review_status = ReviewStatus.REJECTED
            question.rejection_reason = payload.rejection_reason

    elif payload.action == "archive":
        if question.review_status not in (ReviewStatus.APPROVED, ReviewStatus.REJECTED):
            raise HTTPException(
                status_code=400,
                detail="Only approved or rejected questions can be archived.",
            )
        question.review_status = ReviewStatus.ARCHIVED

    db.commit()
    db.refresh(question)
    return question


@router.get("/questions/pending-review")
@router.get("/courses/{course_id}/questions/pending-review")
def get_pending_ai_questions(
    course_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    """
    Fetches pending AI-generated and under-review questions. 
    Supports both global (all courses) and course-specific filters.
    """
    query = db.query(ExamQuestion).filter(
        ExamQuestion.review_status.in_([ReviewStatus.GENERATED, ReviewStatus.UNDER_REVIEW])
    )
    
    if course_id:
        query = query.filter(ExamQuestion.course_id == course_id)
        
    questions = query.all()
    
    return {
        "count": len(questions),
        "questions": questions
    }


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(
    question_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)  # <-- Added missing security guard!
):
    question = db.get(ExamQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if question.review_status == ReviewStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete an approved question — archive it instead.",
        )
    db.delete(question)
    db.commit()

@router.delete("/questions/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_questions(question_ids:
                           List[uuid.UUID], 
                           db: Session = Depends(get_db),
                           current_user: User = Depends(require_admin) 
                           ):
    if not question_ids:
        return {"message": "No IDs provided", "deleted_count": 0}

    deleted_count = db.query(ExamQuestion).filter(
        ExamQuestion.id.in_(question_ids)
    ).delete(synchronize_session=False)
    
    db.commit()
    return {"status": "success", "deleted_count": deleted_count}


@router.patch("/questions/batch-review")
def batch_review_questions(
    payload: BatchReviewRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if not payload.question_ids:
        raise HTTPException(status_code=400, detail="No questions selected for batch review.")
    
    status_value = ReviewStatus.APPROVED if payload.action == "approve" else ReviewStatus.REJECTED
    updated_count = 0

    for q_id in payload.question_ids:
        try:
            q_uuid = q_id if isinstance(q_id, uuid.UUID) else uuid.UUID(str(q_id))
        except (ValueError, TypeError):
            continue
        
        question = db.get(ExamQuestion, q_uuid)
        if question and question.review_status in (ReviewStatus.GENERATED, ReviewStatus.UNDER_REVIEW):
            question.review_status = status_value
            question.reviewed_by_id = current_user.id
            question.reviewed_at = datetime.utcnow()
            
            if payload.action == "approve":
                _promote_to_question(db, question)
            updated_count += 1

    db.commit()
    
    return {
        "success": True, 
        "message": f"Successfully updated {updated_count} questions.",
        "updated": updated_count
    }


@router.get("/courses/{course_id}/duplicates", response_model=list[DuplicateGroupResponse])
def get_course_duplicates(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    duplicate_query = text("""
        SELECT 
            LOWER(REGEXP_REPLACE(question_text, '[^a-zA-Z0-9]', '', 'g')) AS norm_text,
            COUNT(*) AS item_count,
            ARRAY_AGG(id::text) AS question_ids
        FROM exam_questions
        WHERE course_id = :course_id
        GROUP BY norm_text
        HAVING COUNT(*) > 1
    """)

    result = db.execute(duplicate_query, {"course_id": str(course_id)})
    rows = result.mappings().all()

    if not rows:
        return []

    # Collect all unique question IDs
    all_question_ids = [uuid.UUID(q_id) for row in rows for q_id in row["question_ids"]]

    # Fetch all ORM instances in a single DB query
    stmt = select(ExamQuestion).where(ExamQuestion.id.in_(all_question_ids))
    questions_map = {q.id: q for q in db.scalars(stmt).all()}

    # Construct duplicate groups directly using SQLAlchemy ORM objects
    duplicate_groups = []
    for row in rows:
        group_questions = [
            questions_map[uuid.UUID(q_id)]
            for q_id in row["question_ids"]
            if uuid.UUID(q_id) in questions_map
        ]
        duplicate_groups.append(
            DuplicateGroupResponse(
                normalized_text=row["norm_text"],
                count=row["item_count"],
                questions=group_questions,
            )
        )

    return duplicate_groups


@router.post("/questions/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_questions(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
):
    """
    Deletes multiple exam questions by ID in a single atomic database operation.
    Safeguarded to prevent accidental deletion of already APPROVED active questions.
    """
    if not payload.ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No question IDs provided for bulk deletion.",
        )

    # Convert string IDs to UUID objects
    try:
        uuid_ids = [uuid.UUID(str(id)) for id in payload.ids]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question ID format.",
        )

    # First, delete promoted questions from quiz bank
    exam_questions = db.query(ExamQuestion).filter(ExamQuestion.id.in_(uuid_ids)).all()
    promoted_ids = [eq.promoted_question_id for eq in exam_questions if eq.promoted_question_id]
    if promoted_ids:
        db.query(Question).filter(Question.id.in_(promoted_ids)).delete(synchronize_session=False)

    stmt = (
        delete(ExamQuestion)
        .where(ExamQuestion.id.in_(uuid_ids))
    )

    result = db.execute(stmt)
    db.commit()

    return {
        "message": f"Successfully removed {result.rowcount} question(s).",
        "deleted_count": result.rowcount,
    }

# ============================== AI drafting ==============================


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _split_title(markdown: str, fallback_title: str) -> tuple[str, str]:
    lines = markdown.split("\n")
    if lines and lines[0].strip().startswith("#"):
        title = lines[0].lstrip("#").strip()
        rest = "\n".join(lines[1:]).strip()
        return (title or fallback_title), (rest or markdown)
    return fallback_title, markdown


def _course_context_line(course: Course) -> str:
    code_part = f" ({course.code})" if course.code else ""
    return f"Course: {course.name}{code_part}\nExam theme: {course.category}"


def _generate_note(client, course: Course, payload: AIGenerateRequest) -> AINoteDraft:
    system_prompt = (
        "You are an expert Computer Science curriculum writer drafting study notes for the Ethiopian "
        "Ministry of Education CS Exit Exam.\n"
        f"{_course_context_line(course)}\n"
        f"Content type: {payload.material_type.value}\n\n"
        "Write a clear, exam-focused study note in Markdown. Start with a single '# ' heading that is a "
        "concise title, then the body: a short definition/overview, key points, a worked example where "
        "relevant, and a note on how this tends to appear on the exit exam. Respond with ONLY the Markdown "
        "note — no preamble, no commentary, no code fences around the whole note."
    )
    completion = client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Topic: {payload.topic}"},
        ],
        temperature=0.4,
        max_tokens=1200,
    )
    raw = _strip_code_fences(completion.choices[0].message.content)
    title, content = _split_title(raw, fallback_title=payload.topic)
    return AINoteDraft(title=title, content=content)


def _generate_question(client, course: Course, payload: AIGenerateRequest) -> AIQuestionDraft:
    system_prompt = (
        "You are an expert Computer Science exam item writer for the Ethiopian Ministry of Education CS "
        "Exit Exam.\n"
        f"{_course_context_line(course)}\n"
        f"Difficulty: {payload.difficulty.value}\n\n"
        "Write exactly one multiple-choice question with four options (A-D) and exactly one correct "
        "option, plus a clear explanation of why that option is correct and the others are not. "
        "Respond with ONLY a JSON object — no prose, no markdown, no code fences — using exactly these "
        'keys: "question_text", "option_a", "option_b", "option_c", "option_d", "correct_option", '
        '"explanation". "correct_option" must be exactly one of "A", "B", "C", "D".'
    )
    completion = client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Topic: {payload.topic}"},
        ],
        temperature=0.3,
        max_tokens=700,
    )
    raw = _strip_code_fences(completion.choices[0].message.content)
    try:
        data = json.loads(raw)
        return AIQuestionDraft(**data)
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        logger.warning("AI question draft failed to parse: %s | raw=%r", exc, raw)
        raise HTTPException(
            status_code=502, detail="The AI response wasn't in the expected format. Please try again."
        )


@router.post("/ai/generate", response_model=AIGenerateResponse)
@limiter.limit("20/minute")
def generate_ai_content(request: Request, payload: AIGenerateRequest, db: Session = Depends(get_db)):
    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI drafting is not configured (missing GROQ_API_KEY)")

    course = _get_course_or_404(db, payload.course_id)

    if payload.type == "note":
        return AIGenerateResponse(type="note", note=_generate_note(client, course, payload))
    return AIGenerateResponse(type="question", question=_generate_question(client, course, payload))




# ============================== Bulk question-bank import ==============================


def _validate_and_build_questions(course: Course, rows: list[BulkQuestionRow]) -> tuple[list[Question], list[str]]:
    errors: list[str] = []
    to_add: list[Question] = []

    for idx, row in enumerate(rows, start=1):
        correct_answer = row.correct_answer.strip()
        if row.question_type == QuestionType.MULTIPLE_CHOICE:
            if not row.choices:
                errors.append(f"Row {idx}: multiple_choice questions need either 'choices' or all four option_a-d")
                continue
            correct_answer = correct_answer.upper()
            if correct_answer not in row.choices:
                errors.append(
                    f"Row {idx}: correct_answer '{row.correct_answer}' is not one of the choice keys {sorted(row.choices)}"
                )
                continue

        to_add.append(
            Question(
                course_id=course.id,
                topic_id=row.topic_id,
                question_type=row.question_type,
                difficulty=row.difficulty,
                prompt=row.prompt,
                choices=row.choices,
                correct_answer=correct_answer,
                explanation=row.explanation,
            )
        )

    return to_add, errors


@router.post("/courses/{course_id}/questions/bulk-json", response_model=BulkImportResult)
def bulk_import_questions_json(course_id: uuid.UUID, payload: list[BulkQuestionRow], db: Session = Depends(get_db)):
    course = _get_course_or_404(db, course_id)
    if not payload:
        raise HTTPException(status_code=400, detail="The provided question list was empty")

    to_add, errors = _validate_and_build_questions(course, payload)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Question validation failed", "errors": errors})

    db.add_all(to_add)
    db.commit()
    return BulkImportResult(created=len(to_add), errors=[])


@router.post("/questions/bulk-approve")
def bulk_approve_questions(request: BulkApproveRequest, db: Session = Depends(get_db)):
    if not request.question_ids:
        raise HTTPException(status_code=400, detail="No question IDs provided.")

    try:
        uuids = [uuid.UUID(qid) for qid in request.question_ids]
        db.query(ExamQuestion).filter(
            ExamQuestion.id.in_(uuids)
        ).update(
            {"review_status": ReviewStatus.APPROVED}, 
            synchronize_session=False
        )
        
        db.commit()
        return {"status": "success", "message": f"Successfully approved {len(request.question_ids)} questions."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/questions/bulk-master-csv", response_model=BulkImportResult)
async def bulk_import_master_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = await file.read()
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Failed to decode CSV. Ensure the file is UTF-8 encoded.")

    reader = csv.DictReader(io.StringIO(csv_text))
    required_headers = {"course_code", "prompt", "correct_answer"}
    if not reader.fieldnames or not required_headers.issubset(set(reader.fieldnames)):
        missing = required_headers - set(reader.fieldnames or [])
        raise HTTPException(status_code=400, detail=f"CSV is missing required columns: {', '.join(sorted(missing))}")

    course_cache: dict[str, Course] = {}
    to_add: list[Question] = []
    parse_errors: list[str] = []

    for i, raw in enumerate(reader, start=2):
        code = (raw.get("course_code") or "").strip()
        if not code:
            parse_errors.append(f"Row {i}: Missing 'course_code'")
            continue

        if code not in course_cache:
            course = db.query(Course).filter(Course.code == code).first()
            if not course:
                parse_errors.append(f"Row {i}: Course code '{code}' not found in database")
                continue
            course_cache[code] = course

        target_course = course_cache[code]

        try:
            row_data = BulkQuestionRow(
                question_type=(raw.get("question_type") or "multiple_choice").strip(),
                difficulty=(raw.get("difficulty") or "intermediate").strip(),
                prompt=(raw.get("prompt") or "").strip(),
                option_a=raw.get("option_a") or None,
                option_b=raw.get("option_b") or None,
                option_c=raw.get("option_c") or None,
                option_d=raw.get("option_d") or None,
                correct_answer=(raw.get("correct_answer") or "").strip(),
                explanation=raw.get("explanation") or None,
            )
        except ValidationError as exc:
            parse_errors.append(f"Row {i}: {exc.errors()[0]['msg']}")
            continue

        correct_answer = row_data.correct_answer.upper()
        if row_data.question_type == QuestionType.MULTIPLE_CHOICE:
            if not row_data.choices or correct_answer not in row_data.choices:
                parse_errors.append(f"Row {i}: Invalid correct answer '{correct_answer}' for choices.")
                continue

        to_add.append(
            Question(
                course_id=target_course.id,
                topic_id=row_data.topic_id,
                question_type=row_data.question_type,
                difficulty=row_data.difficulty,
                prompt=row_data.prompt,
                choices=row_data.choices,
                correct_answer=correct_answer,
                explanation=row_data.explanation,
            )
        )

    if parse_errors:
        raise HTTPException(status_code=422, detail={"message": "Master CSV validation failed", "errors": parse_errors})
    if not to_add:
        raise HTTPException(status_code=400, detail="The uploaded CSV contained no valid question rows")

    db.add_all(to_add)
    db.commit()
    return BulkImportResult(created=len(to_add), errors=[])


@router.post("/courses/{course_id}/questions/bulk-csv", response_model=BulkImportResult)
async def bulk_import_questions_csv(course_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db)):
    course = _get_course_or_404(db, course_id)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = await file.read()
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Failed to decode CSV. Ensure the file is UTF-8 encoded.")

    reader = csv.DictReader(io.StringIO(csv_text))
    required_headers = {"prompt", "correct_answer"}
    if not reader.fieldnames or not required_headers.issubset(set(reader.fieldnames)):
        missing = required_headers - set(reader.fieldnames or [])
        raise HTTPException(status_code=400, detail=f"CSV is missing required columns: {', '.join(sorted(missing))}")

    rows: list[BulkQuestionRow] = []
    parse_errors: list[str] = []

    for i, raw in enumerate(reader, start=2):
        try:
            rows.append(
                BulkQuestionRow(
                    question_type=(raw.get("question_type") or "multiple_choice").strip(),
                    difficulty=(raw.get("difficulty") or "intermediate").strip(),
                    prompt=(raw.get("prompt") or "").strip(),
                    option_a=raw.get("option_a") or None,
                    option_b=raw.get("option_b") or None,
                    option_c=raw.get("option_c") or None,
                    option_d=raw.get("option_d") or None,
                    correct_answer=(raw.get("correct_answer") or "").strip(),
                    explanation=raw.get("explanation") or None,
                )
            )
        except ValidationError as exc:
            parse_errors.append(f"Row {i}: {exc.errors()[0]['msg']}")
            continue

    if parse_errors:
        raise HTTPException(status_code=422, detail={"message": "CSV row validation failed", "errors": parse_errors})

    to_add, validation_errors = _validate_and_build_questions(course, rows)
    if validation_errors:
        raise HTTPException(status_code=422, detail={"message": "CSV question validation failed", "errors": validation_errors})

    if not to_add:
        raise HTTPException(status_code=400, detail="The uploaded CSV contained no valid question rows.")

    db.add_all(to_add)
    db.commit()
    return BulkImportResult(created=len(to_add), errors=[])