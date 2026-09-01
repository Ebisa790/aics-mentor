import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus
from app.models.quiz import GeneratedExamMode, Question, Quiz, QuizQuestion, QuizType
from app.models.user import User
from app.schemas.attempt import AttemptResultOut, AttemptSubmit, GradedAnswerOut
from app.schemas.quiz import (
    QuestionCreate,
    QuestionOut,
    QuestionWithAnswerOut,
    QuizCreate,
    QuizDetailOut,
    QuizOut,
)
from app.services.exam_generator import sample_questions_for_course

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])
questions_router = APIRouter(prefix="/api/questions", tags=["questions"])


class StudentStatsOut(BaseModel):
    total_attempts: int
    average_score_percent: float
    passed_count: int
    failed_count: int


class QuizGenerateRequest(BaseModel):
    course_id: uuid.UUID
    num_questions: int = 10


def normalize_answer(val: str, question_type: str = "multiple_choice") -> str:
    """Extracts clean uppercase letter (A, B, C, D) or normalizes text response."""
    if not val:
        return ""
    val_str = str(val).strip()
    
    if question_type == "multiple_choice":
        # Match single letters or format like "A.", "b)", "C:"
        match = re.match(r"^([a-dA-D])[\.\:\)]?$", val_str)
        if match:
            return match.group(1).upper()
        if len(val_str) == 1 and val_str.upper() in ["A", "B", "C", "D"]:
            return val_str.upper()
            
    return val_str.strip().lower()


# ==========================================
# QUESTION MANAGEMENT ENDPOINTS
# ==========================================

@questions_router.post("", response_model=QuestionOut, dependencies=[Depends(require_admin)])
def create_question(payload: QuestionCreate, db: Session = Depends(get_db)):
    if payload.question_type == "multiple_choice" and not payload.choices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Multiple-choice questions require 'choices'"
        )
    question = Question(**payload.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@questions_router.get("", response_model=list[QuestionOut], dependencies=[Depends(get_current_user)])
def list_questions(course_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    query = db.query(Question)
    if course_id:
        query = query.filter(Question.course_id == course_id)
    return query.order_by(Question.created_at.desc()).all()


# ==========================================
# QUIZ MANAGEMENT & RE-TAKE GENERATION
# ==========================================

@router.post("/generate", response_model=QuizDetailOut)
def generate_quiz(
    payload: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a new question set dynamically for a specific course.
    Enforces subscription tiers and 3-hour cooldowns for freemium users.
    Prefers unseen questions for the student.
    """
    FREE_QUIZ_COOLDOWN_HOURS = 3

    sub_tier = str(getattr(current_user, "subscription_tier", "") or "").upper()
    user_role = str(getattr(current_user, "role", "") or "").upper()
    is_premium_or_admin = ("PREMIUM" in sub_tier) or ("ADMIN" in user_role) or getattr(current_user, "is_premium", False)

    if not is_premium_or_admin:
        now = datetime.now(timezone.utc)
        cooldown_cutoff = now - timedelta(hours=FREE_QUIZ_COOLDOWN_HOURS)

        # Check last SUBMITTED attempt instead of last generated quiz
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
                        "message": f"Free tier users can take 1 practice quiz every {FREE_QUIZ_COOLDOWN_HOURS} hours. Next quiz unlocks in {time_str}.",
                        "next_available_at": next_available.isoformat(),
                        "retry_after_seconds": seconds,
                    },
                )

    # Use sample_questions_for_course with student_id to prefer unseen questions
    available_questions = sample_questions_for_course(
        db=db,
        course_id=payload.course_id,
        total=payload.num_questions,
        student_id=current_user.id
    )

    if not available_questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questions found for this course to generate a quiz."
        )

    new_quiz = Quiz(
        id=uuid.uuid4(),
        title=f"Practice Quiz ({len(available_questions)} Questions)",
        course_id=payload.course_id,
        quiz_type=QuizType.DAILY_QUIZ,
        generated_mode=GeneratedExamMode.PRACTICE,
        generated_for_user_id=current_user.id,
        time_limit_minutes=15,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_quiz)
    db.flush()

    quiz_questions = [
        QuizQuestion(quiz_id=new_quiz.id, question_id=q.id, order_index=idx)
        for idx, q in enumerate(available_questions)
    ]
    db.add_all(quiz_questions)

    db.commit()
    db.refresh(new_quiz)

    return QuizDetailOut(
        id=new_quiz.id,
        title=new_quiz.title,
        course_id=new_quiz.course_id,
        quiz_type=new_quiz.quiz_type,
        time_limit_minutes=new_quiz.time_limit_minutes,
        questions=available_questions
    )


@router.post("", response_model=QuizOut, dependencies=[Depends(require_admin)])
def create_quiz(payload: QuizCreate, db: Session = Depends(get_db)):
    quiz = Quiz(
        title=payload.title,
        course_id=payload.course_id,
        quiz_type=payload.quiz_type,
        time_limit_minutes=payload.time_limit_minutes,
        created_at=datetime.now(timezone.utc)
    )
    db.add(quiz)
    db.flush()

    quiz_questions = [
        QuizQuestion(quiz_id=quiz.id, question_id=qid, order_index=idx)
        for idx, qid in enumerate(payload.question_ids)
    ]
    db.add_all(quiz_questions)

    db.commit()
    db.refresh(quiz)
    return QuizOut(
        id=quiz.id,
        title=quiz.title,
        quiz_type=quiz.quiz_type,
        time_limit_minutes=quiz.time_limit_minutes,
        question_count=len(payload.question_ids),
    )


@router.get("", response_model=list[QuizOut], dependencies=[Depends(get_current_user)])
def list_quizzes(course_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    query = db.query(Quiz).options(joinedload(Quiz.quiz_questions))
    if course_id:
        query = query.filter(Quiz.course_id == course_id)
    quizzes = query.order_by(Quiz.created_at.desc()).all()
    
    return [
        QuizOut(
            id=q.id,
            title=q.title,
            quiz_type=q.quiz_type,
            time_limit_minutes=q.time_limit_minutes,
            question_count=len(q.quiz_questions),
        )
        for q in quizzes
    ]


@router.get("/attempts/me", response_model=list[AttemptResultOut], dependencies=[Depends(get_current_user)])
def get_my_quiz_attempts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attempts = (
        db.query(Attempt)
        .options(joinedload(Attempt.answers).joinedload(AttemptAnswer.question))
        .filter(Attempt.student_id == current_user.id)
        .order_by(Attempt.submitted_at.desc())
        .all()
    )
    
    results = []
    for attempt in attempts:
        graded_answers = []
        for ans in attempt.answers:
            q = ans.question
            if not q:
                continue
            question_out = QuestionWithAnswerOut(
                id=q.id,
                question_type=q.question_type,
                difficulty=q.difficulty,
                prompt=getattr(q, "question_text", None) or getattr(q, "prompt", ""),
                choices=q.choices,
                correct_answer=q.correct_answer,
                explanation=q.explanation
            )
            graded_answers.append(
                GradedAnswerOut(
                    question=question_out,
                    student_answer=ans.student_answer,
                    is_correct=ans.is_correct,
                    ai_feedback=q.explanation if not ans.is_correct else None
                )
            )

        results.append(
            AttemptResultOut(
                id=attempt.id,
                status=attempt.status,
                score_percent=attempt.score_percent or 0.0,
                submitted_at=attempt.submitted_at,
                late_submission=False,
                graded_answers=graded_answers,
                weak_topics=[]
            )
        )
    return results


@router.get("/stats/me", response_model=StudentStatsOut, dependencies=[Depends(get_current_user)])
def get_my_quiz_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attempts = db.query(Attempt).filter(Attempt.student_id == current_user.id).all()
    
    total_attempts = len(attempts)
    if total_attempts == 0:
        return StudentStatsOut(
            total_attempts=0,
            average_score_percent=0.0,
            passed_count=0,
            failed_count=0
        )

    total_score = sum(att.score_percent or 0.0 for att in attempts)
    average_score = total_score / total_attempts
    
    passed_count = sum(1 for att in attempts if (att.score_percent or 0.0) >= 50.0)
    failed_count = total_attempts - passed_count

    return StudentStatsOut(
        total_attempts=total_attempts,
        average_score_percent=round(average_score, 2),
        passed_count=passed_count,
        failed_count=failed_count
    )


@router.get("/{quiz_id}", response_model=QuizDetailOut, dependencies=[Depends(get_current_user)])
def get_quiz(quiz_id: uuid.UUID, db: Session = Depends(get_db)):
    quiz = (
        db.query(Quiz)
        .options(joinedload(Quiz.quiz_questions).joinedload(QuizQuestion.question))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    sorted_quiz_questions = sorted(quiz.quiz_questions, key=lambda qq: qq.order_index)

    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        course_id=quiz.course_id,
        quiz_type=quiz.quiz_type,
        time_limit_minutes=quiz.time_limit_minutes,
        questions=[qq.question for qq in sorted_quiz_questions if qq.question],
    )


@router.post("/{quiz_id}/submit", response_model=AttemptResultOut, dependencies=[Depends(get_current_user)])
def submit_quiz_or_mock(
    quiz_id: uuid.UUID, 
    payload: AttemptSubmit, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    quiz = (
        db.query(Quiz)
        .options(joinedload(Quiz.quiz_questions).joinedload(QuizQuestion.question))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz or Mock Exam not found")

    try:
        question_map = {str(qq.question.id): qq.question for qq in quiz.quiz_questions if qq.question}
        
        score = 0
        total = len(question_map)
        graded_answers = []

        now = datetime.now(timezone.utc)
        attempt = Attempt(
            student_id=current_user.id,
            quiz_id=quiz.id,
            status=AttemptStatus.SUBMITTED,
            started_at=now,
            submitted_at=now
        )
        db.add(attempt)
        db.flush()

        answer_dict = {}

        if isinstance(payload.answers, list):
            for ans in payload.answers:
                if isinstance(ans, dict):
                    q_id = ans.get("question_id")
                    st_ans = ans.get("student_answer") or ans.get("selected_answer", "")
                else:
                    q_id = getattr(ans, "question_id", None)
                    st_ans = getattr(ans, "student_answer", None) or getattr(ans, "selected_answer", "")

                if q_id:
                    answer_dict[str(q_id).lower()] = str(st_ans)
        elif isinstance(payload.answers, dict):
            for q_id, st_ans in payload.answers.items():
                answer_dict[str(q_id).lower()] = str(st_ans)

        for q_id_str, question in question_map.items():
            student_raw = answer_dict.get(str(q_id_str).lower(), "")
            correct_raw = getattr(question, "correct_answer", None) or getattr(question, "correct_option", None) or ""

            q_type = getattr(question, "question_type", "multiple_choice")
            norm_student = normalize_answer(student_raw, question_type=q_type)
            norm_correct = normalize_answer(correct_raw, question_type=q_type)

            is_correct = bool(norm_student and norm_correct and norm_student == norm_correct)

            if is_correct:
                score += 1

            attempt_answer = AttemptAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                student_answer=student_raw,
                is_correct=is_correct
            )
            db.add(attempt_answer)

            question_out = QuestionWithAnswerOut(
                id=question.id,
                question_type=question.question_type,
                difficulty=question.difficulty,
                prompt=getattr(question, "question_text", None) or getattr(question, "prompt", ""),
                choices=question.choices,
                correct_answer=norm_correct.upper() if q_type == "multiple_choice" else correct_raw,
                explanation=question.explanation
            )

            graded_answers.append(
                GradedAnswerOut(
                    question=question_out,
                    student_answer=student_raw,
                    is_correct=is_correct,
                    ai_feedback=question.explanation if not is_correct else None
                )
            )

        percentage = round((score / total) * 100, 2) if total > 0 else 0.0
        
        attempt.score_percent = percentage
        attempt.status = AttemptStatus.GRADED

        db.commit()

        return AttemptResultOut(
            id=attempt.id,
            status=attempt.status,
            score_percent=attempt.score_percent,
            submitted_at=attempt.submitted_at,
            late_submission=False,
            graded_answers=graded_answers,
            weak_topics=[]
        )

    except Exception as e:
        db.rollback()
        logger.error(f"CRITICAL ERROR in submit_quiz_or_mock: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)}")