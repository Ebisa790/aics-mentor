import logging
import uuid
from datetime import datetime, timedelta, timezone # 👈 Updated imports

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.ai_client import DEFAULT_MODEL, get_groq_client
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.attempt import Attempt, AttemptAnswer, AttemptStatus
from app.models.quiz import GeneratedExamMode, Quiz, Question
from app.models.user import User
from app.schemas.attempt import AttemptStart, AttemptSubmit, AttemptResultOut, GradedAnswerOut
from app.schemas.quiz import QuestionWithAnswerOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/attempts", tags=["attempts"])


@router.post("/start", response_model=dict)
def start_attempt(payload: AttemptStart, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    quiz = db.get(Quiz, payload.quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    if quiz.generated_for_user_id is not None and quiz.generated_for_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This generated exam belongs to another student")

    # ✅ FIXED: Use timezone-aware UTC datetime
    attempt = Attempt(
        student_id=current_user.id, 
        quiz_id=quiz.id, 
        status=AttemptStatus.IN_PROGRESS, 
        started_at=datetime.now(timezone.utc)
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return {"attempt_id": attempt.id, "started_at": attempt.started_at}


def _grade_answer(question: Question, student_answer: str) -> bool:
    return student_answer.strip().lower() == question.correct_answer.strip().lower()


def _generate_ai_feedback(client, question: Question, student_answer: str) -> str | None:
    if client is None:
        return None
    try:
        prompt = (
            "A student answered a Computer Science exit-exam practice question incorrectly.\n"
            f"Question: {question.prompt}\n"
            + (f"Choices: {question.choices}\n" if question.choices else "")
            + f"Student's answer: {student_answer}\n"
            f"Correct answer: {question.correct_answer}\n\n"
            "In 2-3 sentences, explain why the student's answer is wrong and why the correct "
            "answer is right. Be specific and encouraging, and keep it exam-focused."
        )
        completion = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=200,
        )
        return completion.choices[0].message.content.strip()
    except Exception:
        logger.warning("AI feedback generation failed for question %s", question.id, exc_info=True)
        return None


@router.post("/{attempt_id}/submit", response_model=AttemptResultOut)
def submit_attempt(
    attempt_id: uuid.UUID,
    payload: AttemptSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attempt = db.get(Attempt, attempt_id)
    if not attempt or attempt.student_id != current_user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Attempt already submitted")

    quiz = attempt.quiz
    is_practice_mode = quiz.generated_mode == GeneratedExamMode.PRACTICE
    ai_client = get_groq_client() if is_practice_mode else None

    correct_count = 0
    graded_out: list[GradedAnswerOut] = []
    weak_topic_titles: set[str] = set()

    for ans in payload.answers:
        question = db.get(Question, ans.question_id)
        if not question:
            continue
        is_correct = _grade_answer(question, ans.student_answer)
        correct_count += int(is_correct)

        db.add(
            AttemptAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                student_answer=ans.student_answer,
                is_correct=is_correct,
            )
        )

        if not is_correct and question.topic is not None:
            weak_topic_titles.add(question.topic.title)

        ai_feedback = None
        if is_practice_mode and not is_correct:
            ai_feedback = _generate_ai_feedback(ai_client, question, ans.student_answer)

        graded_out.append(
            GradedAnswerOut(
                question=QuestionWithAnswerOut.model_validate(question),
                student_answer=ans.student_answer,
                is_correct=is_correct,
                ai_feedback=ai_feedback,
            )
        )

    total = len(payload.answers) or 1
    score_percent = round((correct_count / total) * 100, 2)
    
    # ✅ FIXED: Use timezone-aware UTC datetime
    submitted_at = datetime.now(timezone.utc)

    # ✅ FIXED: Normalize started_at timezone state to safely handle subtraction
    started_at = attempt.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    late_submission = bool(quiz.time_limit_minutes) and (
        submitted_at - started_at > timedelta(minutes=quiz.time_limit_minutes)
    )

    attempt.status = AttemptStatus.GRADED
    attempt.score_percent = score_percent
    attempt.submitted_at = submitted_at

    db.commit()

    return AttemptResultOut(
        id=attempt.id,
        status=attempt.status,
        score_percent=score_percent,
        submitted_at=attempt.submitted_at,
        late_submission=late_submission,
        graded_answers=graded_out,
        weak_topics=sorted(weak_topic_titles),
    )