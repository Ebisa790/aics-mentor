import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus
from app.models.course import Course
from app.models.quiz import GeneratedExamMode, Question, Quiz, QuizQuestion, QuizType
from app.models.user import SubscriptionTier, User, UserRole
from app.schemas.exam import GenerateExamRequest, GenerateExamResponse
from app.services.exam_generator import (
    sample_questions_for_course,
    sample_questions_for_official_mock,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exams", tags=["exams"])

PRACTICE_QUESTION_COUNT = 10
MOCK_TIME_LIMIT_MINUTES = 120
FREE_QUIZ_COOLDOWN_HOURS = 3


class TargetedExamRequest(BaseModel):
    question_ids: List[uuid.UUID]
    title: str = "Targeted Weakness Review"


def normalize_answer(val: str) -> str:
    """Extracts a clean uppercase letter (A, B, C, D) from various formats like 'b', 'b.', or 'b: ...'"""
    if not val:
        return ""
    val_str = str(val).strip()
    match = re.match(r"^([a-dA-D])[\.\:\)]?", val_str)
    if match:
        return match.group(1).upper()
    if len(val_str) == 1 and val_str.upper() in ["A", "B", "C", "D"]:
        return val_str.upper()
    return val_str.upper()


def _check_premium_or_admin(user: User) -> bool:
    """
    Checks if a user has Premium status or Admin access.
    Supports flexible custom pricing plans managed by admins.
    """
    if user.role == UserRole.ADMIN:
        return True
    
    if user.subscription_tier == SubscriptionTier.PREMIUM:
        # Check expiration date if applicable
        if getattr(user, "subscription_expires_at", None):
            now = datetime.now(timezone.utc)
            expires = user.subscription_expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            return expires > now
        return True

    return False


def _process_exam_generation(payload: GenerateExamRequest, db: Session, current_user: User) -> Quiz:
    """
    Core engine to enforce pricing tier limits and construct a Quiz model instance.
    """
    is_premium_or_admin = _check_premium_or_admin(current_user)
    requested_count = getattr(payload, "question_count", None) or getattr(payload, "num_questions", None) or 100

    # 1. Mock Exam Security Check (Requires Premium Plan)
    if payload.mode == "mock":
        if not is_premium_or_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Full mock exams are a Premium feature. Please upgrade your plan to get access.",
            )

        title = f"National Exit Exam Simulation ({requested_count}-Question Mock)"
        quiz_type = QuizType.FULL_SIMULATION
        generated_mode = GeneratedExamMode.MOCK
        time_limit = MOCK_TIME_LIMIT_MINUTES if requested_count >= 50 else 60
        target_course_id = None

        # Pass student_id to prefer unseen questions
        questions = sample_questions_for_official_mock(
            db, 
            total_count=requested_count,
            student_id=current_user.id
        )

    # 2. Practice Mode (Rate-limited for Free Tier)
    else:
        if not payload.course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="course_id is required for practice mode.",
            )

        course = db.get(Course, payload.course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )

        # Enforce Cooldown for Freemium Users (SUBMISSION-BASED)
        if not is_premium_or_admin:
            now = datetime.now(timezone.utc)
            cooldown_cutoff = now - timedelta(hours=FREE_QUIZ_COOLDOWN_HOURS)

            # Check last SUBMITTED attempt, not last generated quiz
            last_attempt = (
                db.query(Attempt)
                .join(Quiz, Attempt.quiz_id == Quiz.id)
                .filter(
                    Attempt.student_id == current_user.id,
                    Quiz.generated_mode == GeneratedExamMode.PRACTICE,
                    Attempt.status == AttemptStatus.GRADED
                )
                .order_by(Attempt.submitted_at.desc())
                .first()
            )

            if last_attempt and last_attempt.submitted_at:
                last_submitted_time = last_attempt.submitted_at
                if last_submitted_time.tzinfo is None:
                    last_submitted_time = last_submitted_time.replace(tzinfo=timezone.utc)

                if last_submitted_time > cooldown_cutoff:
                    next_available = last_submitted_time + timedelta(hours=FREE_QUIZ_COOLDOWN_HOURS)
                    remaining_time = next_available - now

                    seconds = max(0, int(remaining_time.total_seconds()))
                    hours, remainder = divmod(seconds, 3600)
                    minutes, _ = divmod(remainder, 60)

                    time_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "quiz_cooldown_active",
                            "message": f"Free tier users can take 1 practice quiz every {FREE_QUIZ_COOLDOWN_HOURS} hours. Upgrade to Premium for unlimited practice. Next quiz unlocks in {time_str}.",
                            "next_available_at": next_available.isoformat(),
                            "retry_after_seconds": seconds,
                        },
                    )

        title = f"Practice Set: {course.name}"
        quiz_type = QuizType.DAILY_QUIZ
        generated_mode = GeneratedExamMode.PRACTICE
        time_limit = None
        target_course_id = course.id

        # Pass student_id to prefer unseen questions
        questions = sample_questions_for_course(
            db, 
            course.id, 
            PRACTICE_QUESTION_COUNT,
            current_user.id
        )
        if len(questions) > PRACTICE_QUESTION_COUNT:
            questions = questions[:PRACTICE_QUESTION_COUNT]

    quiz = Quiz(
        course_id=target_course_id,
        title=title,
        quiz_type=quiz_type,
        time_limit_minutes=time_limit,
        generated_mode=generated_mode,
        generated_for_user_id=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(quiz)
    db.flush()

    # Insert Questions
    quiz_questions = [
        QuizQuestion(quiz_id=quiz.id, question_id=question.id, order_index=idx)
        for idx, question in enumerate(questions)
    ]
    db.add_all(quiz_questions)

    db.commit()
    db.refresh(quiz)

    return quiz


@router.post("/generate", response_model=GenerateExamResponse)
def generate_exam(
    payload: GenerateExamRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = _process_exam_generation(payload, db, current_user)
    return GenerateExamResponse(
        quiz_id=quiz.id,
        mode=payload.mode,
        question_count=len(quiz.quiz_questions) if quiz.quiz_questions else 0,
        time_limit_minutes=quiz.time_limit_minutes,
    )


@router.post("/start")
def start_exam(
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mode = payload.get("mode", "mock") if payload else "mock"
    course_id = payload.get("course_id") if payload else None
    requested_count = payload.get("num_questions") or payload.get("question_count", 100) if payload else 100

    req_payload = GenerateExamRequest(
        mode=mode,
        course_id=course_id,
        question_count=requested_count,
    )

    quiz = _process_exam_generation(req_payload, db, current_user)

    formatted_questions = []
    if quiz.quiz_questions:
        for qq in quiz.quiz_questions:
            q = qq.question
            if q:
                raw_choices = getattr(q, "choices", [])
                if isinstance(raw_choices, str):
                    try:
                        raw_choices = json.loads(raw_choices)
                    except Exception:
                        raw_choices = []

                if isinstance(raw_choices, dict):
                    opt_a = getattr(q, "option_a", None) or raw_choices.get("0") or raw_choices.get("a") or raw_choices.get("A") or ""
                    opt_b = getattr(q, "option_b", None) or raw_choices.get("1") or raw_choices.get("b") or raw_choices.get("B") or ""
                    opt_c = getattr(q, "option_c", None) or raw_choices.get("2") or raw_choices.get("c") or raw_choices.get("C") or ""
                    opt_d = getattr(q, "option_d", None) or raw_choices.get("3") or raw_choices.get("d") or raw_choices.get("D") or ""
                elif isinstance(raw_choices, (list, tuple)):
                    opt_a = getattr(q, "option_a", None) or (raw_choices[0] if len(raw_choices) > 0 else "")
                    opt_b = getattr(q, "option_b", None) or (raw_choices[1] if len(raw_choices) > 1 else "")
                    opt_c = getattr(q, "option_c", None) or (raw_choices[2] if len(raw_choices) > 2 else "")
                    opt_d = getattr(q, "option_d", None) or (raw_choices[3] if len(raw_choices) > 3 else "")
                else:
                    opt_a = getattr(q, "option_a", None) or ""
                    opt_b = getattr(q, "option_b", None) or ""
                    opt_c = getattr(q, "option_c", None) or ""
                    opt_d = getattr(q, "option_d", None) or ""

                choices_dict = {"A": opt_a, "B": opt_b, "C": opt_c, "D": opt_d}

                formatted_questions.append({
                    "id": str(q.id),
                    "course_id": str(q.course_id) if q.course_id else "",
                    "prompt": getattr(q, "question_text", None) or getattr(q, "prompt", ""),
                    "choices": choices_dict,
                    "question_type": "multiple_choice",
                })

    return {
        "id": str(quiz.id),
        "title": quiz.title,
        "time_limit_minutes": quiz.time_limit_minutes,
        "quiz_questions": [
            {"question": fq, "order_index": i} for i, fq in enumerate(formatted_questions)
        ],
    }


@router.post("/{quiz_id}/submit")
def submit_exam(
    quiz_id: str,
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        quiz_uuid = uuid.UUID(quiz_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid quiz ID format.")

    quiz = (
        db.query(Quiz)
        .options(joinedload(Quiz.quiz_questions).joinedload(QuizQuestion.question))
        .filter(Quiz.id == quiz_uuid)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz session not found.")

    # IDOR protection: Ensure the quiz belongs to the current user
    if quiz.generated_for_user_id is not None and quiz.generated_for_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This exam belongs to another student")

    user_answers = payload.get("answers", {}) if payload else {}

    total_questions = len(quiz.quiz_questions) if quiz.quiz_questions else 0
    correct_count = 0
    detailed_results = []

    attempt = Attempt(
        student_id=current_user.id,
        quiz_id=quiz.id,
        status=AttemptStatus.SUBMITTED,
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.flush()

    for qq in quiz.quiz_questions:
        q = qq.question
        if q:
            q_id_str = str(q.id)
            user_choice = user_answers.get(q_id_str)
            raw_correct = getattr(q, "correct_answer", None) or getattr(q, "correct_option", None) or getattr(q, "answer", None)

            norm_user = normalize_answer(user_choice)
            norm_correct = normalize_answer(raw_correct)

            is_correct = bool(norm_user and norm_correct and norm_user == norm_correct)
            if is_correct:
                correct_count += 1

            attempt_ans = AttemptAnswer(
                attempt_id=attempt.id,
                question_id=q.id,
                student_answer=user_choice or "",
                is_correct=is_correct,
            )
            db.add(attempt_ans)

            # Get course name for domain breakdown
            course_name = None
            course_id_val = getattr(q, "course_id", None)
            if course_id_val:
                from app.models.course import Course
                course_obj = db.get(Course, course_id_val)
                course_name = course_obj.name if course_obj else None

            detailed_results.append({
                "question_id": q_id_str,
                "prompt": getattr(q, "question_text", None) or getattr(q, "prompt", ""),
                "user_answer": user_choice or "",
                "correct_answer": norm_correct if norm_correct else "A",
                "is_correct": is_correct,
                "explanation": getattr(q, "explanation", None),
                "course_id": str(course_id_val) if course_id_val else None,
                "course_name": course_name,
            })

    score_percentage = round((correct_count / total_questions * 100), 2) if total_questions > 0 else 0.0

    attempt.score_percent = score_percentage
    attempt.status = AttemptStatus.GRADED
    db.commit()

    # Optional backup log
    try:
        os.makedirs("submissions", exist_ok=True)
        file_path = f"submissions/quiz_{quiz_id}_user_{current_user.id}.json"
        with open(file_path, "w") as f:
            json.dump({
                "user_id": str(current_user.id),
                "quiz_id": str(quiz.id),
                "score_percentage": score_percentage,
                "answers": user_answers,
                "results": detailed_results,
            }, f, indent=4)
    except Exception as e:
        logger.warning(f"Failed to write local backup submission file: {e}")

    return {
        "id": str(quiz.id),
        "quiz_id": str(quiz.id),
        "title": quiz.title,
        "total_questions": total_questions,
        "correct_count": correct_count,
        "score_percent": score_percentage,
        "passed": score_percentage >= 50.0,
        "results": detailed_results,
    }


@router.post("/start-targeted")
def start_targeted_exam(
    payload: TargetedExamRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _check_premium_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Targeted Weakness Reviews are restricted to Premium members.",
        )

    if not payload.question_ids:
        raise HTTPException(status_code=400, detail="No question IDs provided for targeted review.")

    questions = db.query(Question).filter(Question.id.in_(payload.question_ids)).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No matching questions found.")

    new_quiz = Quiz(
        title=payload.title,
        quiz_type=QuizType.DAILY_QUIZ,
        time_limit_minutes=len(questions) * 2,
        generated_mode=GeneratedExamMode.PRACTICE,
        generated_for_user_id=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_quiz)
    db.flush()

    quiz_questions = [
        QuizQuestion(quiz_id=new_quiz.id, question_id=q.id, order_index=idx)
        for idx, q in enumerate(questions)
    ]
    db.add_all(quiz_questions)

    db.commit()

    return {
        "id": str(new_quiz.id),
        "title": new_quiz.title,
        "quiz_questions": [
            {
                "question": {
                    "id": str(q.id),
                    "prompt": getattr(q, "question_text", None) or getattr(q, "prompt", ""),
                    "choices": getattr(q, "choices", []),
                }
            }
            for q in questions
        ],
    }

# ============================================================
# EXAM HISTORY
# ============================================================

def _format_question_options(q) -> dict:
    """Return {option_a, option_b, option_c, option_d} from a Question row,
    handling both the individual-columns layout and the legacy choices dict."""
    raw_choices = getattr(q, "choices", []) or []
    if isinstance(raw_choices, str):
        try:
            raw_choices = json.loads(raw_choices)
        except Exception:
            raw_choices = []

    if isinstance(raw_choices, dict):
        return {
            "option_a": getattr(q, "option_a", None) or raw_choices.get("0") or raw_choices.get("a") or raw_choices.get("A") or "",
            "option_b": getattr(q, "option_b", None) or raw_choices.get("1") or raw_choices.get("b") or raw_choices.get("B") or "",
            "option_c": getattr(q, "option_c", None) or raw_choices.get("2") or raw_choices.get("c") or raw_choices.get("C") or "",
            "option_d": getattr(q, "option_d", None) or raw_choices.get("3") or raw_choices.get("d") or raw_choices.get("D") or "",
        }
    if isinstance(raw_choices, (list, tuple)):
        return {
            "option_a": getattr(q, "option_a", None) or (raw_choices[0] if len(raw_choices) > 0 else ""),
            "option_b": getattr(q, "option_b", None) or (raw_choices[1] if len(raw_choices) > 1 else ""),
            "option_c": getattr(q, "option_c", None) or (raw_choices[2] if len(raw_choices) > 2 else ""),
            "option_d": getattr(q, "option_d", None) or (raw_choices[3] if len(raw_choices) > 3 else ""),
        }
    return {
        "option_a": getattr(q, "option_a", None) or "",
        "option_b": getattr(q, "option_b", None) or "",
        "option_c": getattr(q, "option_c", None) or "",
        "option_d": getattr(q, "option_d", None) or "",
    }


@router.get("/history")
def list_exam_history(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's past mock exam attempts (newest first)."""
    from sqlalchemy import func as sqlfunc
    from app.models.quiz import Question as QuestionModel

    safe_limit = max(1, min(limit, 100))
    safe_offset = max(0, offset)

    # Total count for pagination
    total_count = (
        db.query(sqlfunc.count(Attempt.id))
        .join(Quiz, Attempt.quiz_id == Quiz.id)
        .filter(
            Attempt.student_id == current_user.id,
            Quiz.generated_mode == GeneratedExamMode.MOCK,
            Attempt.status == AttemptStatus.GRADED,
        )
        .scalar()
        or 0
    )

    rows = (
        db.query(Attempt, Quiz)
        .join(Quiz, Attempt.quiz_id == Quiz.id)
        .filter(
            Attempt.student_id == current_user.id,
            Quiz.generated_mode == GeneratedExamMode.MOCK,
            Attempt.status == AttemptStatus.GRADED,
        )
        .order_by(Attempt.submitted_at.desc().nullslast())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )

    items = []
    for attempt, quiz in rows:
        total_q = (
            db.query(sqlfunc.count(AttemptAnswer.id))
            .filter(AttemptAnswer.attempt_id == attempt.id)
            .scalar()
            or 0
        )
        correct_q = (
            db.query(sqlfunc.count(AttemptAnswer.id))
            .filter(
                AttemptAnswer.attempt_id == attempt.id,
                AttemptAnswer.is_correct == True,
            )
            .scalar()
            or 0
        )

        # Weak areas: for each wrong answer, get its course name, count them
        wrong_rows = (
            db.query(QuestionModel.course_id)
            .join(AttemptAnswer, AttemptAnswer.question_id == QuestionModel.id)
            .filter(
                AttemptAnswer.attempt_id == attempt.id,
                AttemptAnswer.is_correct == False,
            )
            .all()
        )

        course_counts: dict[str, int] = {}
        for (course_id_val,) in wrong_rows:
            if not course_id_val:
                continue
            c = db.get(Course, course_id_val)
            if c and c.name:
                course_counts[c.name] = course_counts.get(c.name, 0) + 1

        # Sort by most wrong, take top 3
        weak_areas = [
            name
            for name, _count in sorted(
                course_counts.items(), key=lambda kv: kv[1], reverse=True
            )[:3]
        ]

        duration_seconds = None
        if quiz.created_at and attempt.submitted_at:
            try:
                duration_seconds = int(
                    (attempt.submitted_at - quiz.created_at).total_seconds()
                )
            except Exception:
                duration_seconds = None

        items.append({
            "id": str(attempt.id),
            "quiz_id": str(quiz.id),
            "title": quiz.title,
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "score_percent": float(attempt.score_percent or 0.0),
            "total_questions": int(total_q),
            "correct_count": int(correct_q),
            "passed": float(attempt.score_percent or 0.0) >= 50.0,
            "duration_seconds": duration_seconds,
            "weak_areas": weak_areas,
        })

    # Stats — computed across ALL attempts, not just this page
    all_scores = [
        float(s or 0.0)
        for (s,) in (
            db.query(Attempt.score_percent)
            .join(Quiz, Attempt.quiz_id == Quiz.id)
            .filter(
                Attempt.student_id == current_user.id,
                Quiz.generated_mode == GeneratedExamMode.MOCK,
                Attempt.status == AttemptStatus.GRADED,
            )
            .all()
        )
    ]

    stats = {
        "total_attempts": total_count,
        "average_score": round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0,
        "best_score": max(all_scores) if all_scores else 0.0,
        "last_score": all_scores[0] if all_scores else 0.0,
        "has_more": (safe_offset + safe_limit) < total_count,
    }

    return {
        "items": items,
        "stats": stats,
        "offset": safe_offset,
        "limit": safe_limit,
    }


@router.get("/history/{attempt_id}")
def get_exam_attempt_detail(
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full detail of a past mock exam attempt (questions, answers, explanations)."""
    try:
        attempt_uuid = uuid.UUID(attempt_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid attempt ID format.")

    attempt = db.get(Attempt, attempt_uuid)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    if attempt.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="This attempt belongs to another student.")

    quiz = db.get(Quiz, attempt.quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    answers = (
        db.query(AttemptAnswer)
        .options(joinedload(AttemptAnswer.question))
        .filter(AttemptAnswer.attempt_id == attempt.id)
        .all()
    )

    # Preserve the order the questions appeared in the exam.
    qq_order = {
        str(qq.question_id): qq.order_index
        for qq in (
            db.query(QuizQuestion)
            .filter(QuizQuestion.quiz_id == quiz.id)
            .all()
        )
    }
    answers.sort(key=lambda a: qq_order.get(str(a.question_id), 0))

    results = []
    for ans in answers:
        q = ans.question
        if not q:
            continue

        course_name = None
        course_id_val = getattr(q, "course_id", None)
        if course_id_val:
            c = db.get(Course, course_id_val)
            course_name = c.name if c else None

        opts = _format_question_options(q)
        raw_correct = (
            getattr(q, "correct_answer", None)
            or getattr(q, "correct_option", None)
            or getattr(q, "answer", None)
        )

        results.append({
            "question_id": str(q.id),
            "prompt": getattr(q, "question_text", None) or getattr(q, "prompt", ""),
            "option_a": opts["option_a"],
            "option_b": opts["option_b"],
            "option_c": opts["option_c"],
            "option_d": opts["option_d"],
            "user_answer": ans.student_answer or "",
            "correct_answer": normalize_answer(raw_correct) if raw_correct else "",
            "is_correct": bool(ans.is_correct),
            "explanation": getattr(q, "explanation", None),
            "course_id": str(course_id_val) if course_id_val else None,
            "course_name": course_name,
        })

    correct_count = sum(1 for r in results if r["is_correct"])
    total_count = len(results)
    score_percent = float(attempt.score_percent or 0.0)

    return {
        "id": str(attempt.id),
        "quiz_id": str(quiz.id),
        "title": quiz.title,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "score_percent": score_percent,
        "total_questions": total_count,
        "correct_count": correct_count,
        "passed": score_percent >= 50.0,
        "results": results,
    }

# ============================================================
# ADMIN — RESET HISTORY
# ============================================================

@router.post("/history/reset")
def reset_my_mock_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only: permanently delete all of the current user's mock exam attempts.

    Cascades to attempt_answers via the FK constraint.
    Also cleans up the mock quizzes that were generated just for this user.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action is admin-only.",
        )

    # Collect quiz IDs tied to this user's mock attempts (for later cleanup)
    attempt_rows = (
        db.query(Attempt.id, Attempt.quiz_id)
        .join(Quiz, Attempt.quiz_id == Quiz.id)
        .filter(
            Attempt.student_id == current_user.id,
            Quiz.generated_mode == GeneratedExamMode.MOCK,
        )
        .all()
    )

    attempt_ids = [row[0] for row in attempt_rows]
    quiz_ids = list({row[1] for row in attempt_rows})

    if not attempt_ids:
        return {
            "success": True,
            "deleted_attempts": 0,
            "deleted_quizzes": 0,
            "message": "No mock attempts to delete.",
        }

    # Delete attempts — attempt_answers cascade-deletes automatically
    deleted_attempts = (
        db.query(Attempt)
        .filter(Attempt.id.in_(attempt_ids))
        .delete(synchronize_session=False)
    )

    # Delete the mock quizzes that were generated for this user only.
    # Guard: only remove quizzes that no longer have any attempts attached.
    deleted_quizzes = 0
    if quiz_ids:
        # Find quizzes with no remaining attempts
        remaining_quizzes_with_attempts = {
            row[0]
            for row in (
                db.query(Attempt.quiz_id)
                .filter(Attempt.quiz_id.in_(quiz_ids))
                .distinct()
                .all()
            )
        }
        quizzes_to_delete = [
            qid for qid in quiz_ids if qid not in remaining_quizzes_with_attempts
        ]

        if quizzes_to_delete:
            deleted_quizzes = (
                db.query(Quiz)
                .filter(
                    Quiz.id.in_(quizzes_to_delete),
                    Quiz.generated_for_user_id == current_user.id,
                    Quiz.generated_mode == GeneratedExamMode.MOCK,
                )
                .delete(synchronize_session=False)
            )

    db.commit()

    logger.info(
        f"Admin {current_user.id} reset own mock history: "
        f"{deleted_attempts} attempts, {deleted_quizzes} quizzes removed"
    )

    return {
        "success": True,
        "deleted_attempts": int(deleted_attempts),
        "deleted_quizzes": int(deleted_quizzes),
        "message": (
            f"Deleted {deleted_attempts} attempt"
            f"{'s' if deleted_attempts != 1 else ''}."
        ),
    }