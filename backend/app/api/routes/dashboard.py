"""
Student dashboard data endpoint.

Returns the compact snapshot needed to render a personal, motivating
dashboard: last activity, weakest subjects, recent history, and streak.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.attempt import Attempt, AttemptStatus
from app.models.quiz import Quiz
from app.models.course import Course

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _relative_time(dt: datetime | None) -> str:
    """'2 hours ago' style relative time, honest and human."""
    if dt is None:
        return "recently"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    seconds = int((now - dt).total_seconds())
    if seconds < 60:
        return "just now"
    if seconds < 3600:
        m = seconds // 60
        return f"{m} minute{'s' if m != 1 else ''} ago"
    if seconds < 86400:
        h = seconds // 3600
        return f"{h} hour{'s' if h != 1 else ''} ago"
    d = seconds // 86400
    if d < 7:
        return f"{d} day{'s' if d != 1 else ''} ago"
    if d < 30:
        w = d // 7
        return f"{w} week{'s' if w != 1 else ''} ago"
    return dt.strftime("%b %d, %Y")


def _compute_streak(attempts: list[Attempt]) -> int:
    """
    Count consecutive days ending today or yesterday.
    A day counts if the student submitted at least one attempt.
    """
    if not attempts:
        return 0

    today = datetime.now(timezone.utc).date()
    days_with_activity = set()

    for a in attempts:
        ts = a.submitted_at or a.started_at
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        days_with_activity.add(ts.date())

    if not days_with_activity:
        return 0

    # Start from today if they studied today, otherwise yesterday
    if today in days_with_activity:
        cursor = today
    elif (today - timedelta(days=1)) in days_with_activity:
        cursor = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    while cursor in days_with_activity:
        streak += 1
        cursor -= timedelta(days=1)

    return streak


@router.get("/me")
def get_my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Personal dashboard snapshot for the current student.

    Returns:
      - last_activity: most recent submitted attempt (or null)
      - recent_activity: last 3 submitted attempts
      - weakest_subjects: 2 lowest-scoring courses with >= 2 attempts
      - streak_days: consecutive days with any activity
    """
    # All completed attempts for this student
    attempts: list[Attempt] = (
        db.query(Attempt)
        .filter(
            Attempt.student_id == current_user.id,
            Attempt.status == AttemptStatus.GRADED,
        )
        .order_by(Attempt.submitted_at.desc())
        .all()
    )

    # ── Last activity + recent list ─────────────────────────
    # Enrich with quiz + course info (batch-load quizzes to avoid N+1)
    quiz_ids = list({a.quiz_id for a in attempts if a.quiz_id})
    quizzes = {}
    if quiz_ids:
        for q in db.query(Quiz).filter(Quiz.id.in_(quiz_ids)).all():
            quizzes[q.id] = q

    course_ids = list({q.course_id for q in quizzes.values() if q.course_id})
    courses = {}
    if course_ids:
        for c in db.query(Course).filter(Course.id.in_(course_ids)).all():
            courses[c.id] = c

    def _attempt_summary(a: Attempt) -> dict:
        q = quizzes.get(a.quiz_id)
        c = courses.get(q.course_id) if q and q.course_id else None
        # Human-friendly label
        if c:
            label = c.name
        elif q and q.title:
            label = q.title
        else:
            label = "Practice session"

        # Distinguish mock exams from practice
        is_mock = bool(q and getattr(q, "generated_mode", None) == "mock")
        activity_type = "Mock Exam" if is_mock else "Practice"

        return {
            "id": str(a.id),
            "type": activity_type,
            "label": label,
            "course_id": str(c.id) if c else None,
            "score": round(a.score_percent or 0.0, 1),
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
            "relative_when": _relative_time(a.submitted_at or a.started_at),
        }

    last_activity = _attempt_summary(attempts[0]) if attempts else None
    recent_activity = [_attempt_summary(a) for a in attempts[:3]]

    # ── Weakest subjects ────────────────────────────────────
    # Aggregate score by course, but only courses with >= 2 attempts.
    scores_by_course: dict[uuid.UUID, list[float]] = defaultdict(list)
    for a in attempts:
        q = quizzes.get(a.quiz_id)
        if not q or not q.course_id:
            continue
        scores_by_course[q.course_id].append(float(a.score_percent or 0.0))

    weakest: list[dict] = []
    for course_id, scores in scores_by_course.items():
        if len(scores) < 2:
            continue
        avg = sum(scores) / len(scores)
        c = courses.get(course_id)
        if not c:
            continue
        weakest.append({
            "course_id": str(course_id),
            "course_name": c.name,
            "average_score": round(avg, 1),
            "attempts": len(scores),
        })

    weakest.sort(key=lambda x: x["average_score"])
    weakest_subjects = weakest[:2]

    # ── Streak ──────────────────────────────────────────────
    streak_days = _compute_streak(attempts)

    return {
        "last_activity": last_activity,
        "recent_activity": recent_activity,
        "weakest_subjects": weakest_subjects,
        "streak_days": streak_days,
    }