import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.admin_user import AdminUserOut, AdminUserUpdate

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/users", 
    tags=["admin-users"], 
    dependencies=[Depends(require_admin)]
)


@router.get("", response_model=list[AdminUserOut], dependencies=[Depends(require_admin)])
def list_users(
    search: str | None = None,
    is_active: bool | None = None,
    subscription_tier: str | None = None,
    role: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Lists all registered users with optional search (by email or name),
    filtering by active status, subscription tier, or role,
    and pagination control.
    """
    query = db.query(User)
    
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(User.email.ilike(like), User.full_name.ilike(like)))
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    if subscription_tier:
        query = query.filter(User.subscription_tier == subscription_tier)
    
    if role:
        query = query.filter(User.role == role)
        
    return query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()


@router.patch("/{user_id}", response_model=AdminUserOut, dependencies=[Depends(require_admin)])
def update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Updates user account details, including role, active status,
    subscription tier (FREE / PREMIUM), and AI usage quotas.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)

    # Prevent admin self-demotion or self-deactivation
    if user.id == current_user.id and (
        ("role" in data and data["role"] != user.role) 
        or ("is_active" in data and data["is_active"] is False)
    ):
        raise HTTPException(
            status_code=400, 
            detail="You cannot demote or deactivate your own account."
        )

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user

@router.get("/export", dependencies=[Depends(require_admin)])
def export_users_csv(
    search: str | None = None,
    is_active: bool | None = None,
    subscription_tier: str | None = None,
    role: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Export user data as CSV for reporting and analytics.
    Supports the same filters as the list endpoint.
    """
    from fastapi.responses import Response
    import csv
    from io import StringIO
    
    query = db.query(User)
    
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(User.email.ilike(like), User.full_name.ilike(like)))
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    if subscription_tier:
        query = query.filter(User.subscription_tier == subscription_tier)
    
    if role:
        query = query.filter(User.role == role)
    
    users = query.order_by(User.created_at.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Write headers
    writer.writerow([
        'Email', 
        'Full Name', 
        'Role', 
        'Subscription Tier', 
        'Active', 
        'AI Usage Count',
        'University',
        'Year of Study',
        'Created At'
    ])
    
    # Write data
    for user in users:
        writer.writerow([
            user.email,
            user.full_name,
            user.role.value if hasattr(user.role, 'value') else user.role,
            user.subscription_tier.value if hasattr(user.subscription_tier, 'value') else user.subscription_tier,
            'Yes' if user.is_active else 'No',
            user.ai_usage_count,
            user.university or '',
            user.year_of_study or '',
            user.created_at.isoformat() if user.created_at else ''
        ])
    
    csv_content = output.getvalue()
    
    logger.info(f"Exporting user data to CSV: {datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}")
    return Response(
        content=csv_content,
        media_type='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename=users_export_{datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")}.csv'
        }
    )

@router.delete("/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Admin-only: permanently delete a user.

    Safety rule: refuses to delete verified accounts, since those have real
    progress and (potentially) payments attached. For verified users, use
    PATCH with is_active=false instead.
    """
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    if target.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account.",
        )

    if getattr(target, "email_verified", False):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete verified users. Deactivate them instead.",
        )

    deleted_email = target.email
    db.delete(target)
    db.commit()

    logger.info(
        f"Admin {current_user.id} deleted unverified user {user_id} ({deleted_email})"
    )

    return {"success": True, "deleted_email": deleted_email}


@router.get("/{user_id}/detail", dependencies=[Depends(require_admin)])
def get_user_detail(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    Comprehensive view of a single user for admin review.
    Returns identity, activity stats, subscription, and a unified timeline.
    """
    from app.models.attempt import Attempt, AttemptStatus
    from app.models.quiz import Quiz, GeneratedExamMode
    from app.models.conversation import AIConversation
    from app.models.payment import Payment, PaymentStatus, Subscription

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)

    # ── Quiz attempts (practice mode) ──
    quiz_rows = (
        db.query(Attempt, Quiz)
        .join(Quiz, Attempt.quiz_id == Quiz.id)
        .filter(
            Attempt.student_id == user.id,
            Quiz.generated_mode == GeneratedExamMode.PRACTICE,
            Attempt.status == AttemptStatus.GRADED,
        )
        .order_by(Attempt.submitted_at.desc().nullslast())
        .all()
    )
    quiz_scores = [
        float(a.score_percent)
        for a, _ in quiz_rows
        if a.score_percent is not None
    ]
    quiz_avg = round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else None
    quiz_best = max(quiz_scores) if quiz_scores else None

    # ── Mock exam attempts ──
    mock_rows = (
        db.query(Attempt, Quiz)
        .join(Quiz, Attempt.quiz_id == Quiz.id)
        .filter(
            Attempt.student_id == user.id,
            Quiz.generated_mode == GeneratedExamMode.MOCK,
            Attempt.status == AttemptStatus.GRADED,
        )
        .order_by(Attempt.submitted_at.desc().nullslast())
        .all()
    )
    mock_scores = [
        float(a.score_percent)
        for a, _ in mock_rows
        if a.score_percent is not None
    ]
    mock_avg = round(sum(mock_scores) / len(mock_scores), 1) if mock_scores else None
    mock_best = max(mock_scores) if mock_scores else None

    # ── Tutor conversations ──
    tutor_sessions = (
        db.query(AIConversation)
        .filter(AIConversation.student_id == user.id)
        .order_by(AIConversation.updated_at.desc().nullslast())
        .limit(20)
        .all()
    )

    # ── Payments ──
    payments = (
        db.query(Payment)
        .filter(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc().nullslast())
        .all()
    )
    paid_payments = [p for p in payments if p.status == PaymentStatus.SUCCESS]
    total_paid = sum(float(p.amount) for p in paid_payments)

    # ── Subscription ──
    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.started_at.desc().nullslast())
        .first()
    )

    # ── Unified timeline ──
    timeline: list[dict] = []

    if user.created_at:
        timeline.append({
            "type": "register",
            "label": "Registered",
            "at": user.created_at.isoformat(),
            "meta": None,
        })

    if getattr(user, "email_verified", False) and getattr(user, "email_verified_at", None):
        timeline.append({
            "type": "verify",
            "label": "Verified email",
            "at": user.email_verified_at.isoformat(),
            "meta": None,
        })

    for a, q in quiz_rows[:10]:
        at = a.submitted_at or a.started_at
        if not at:
            continue
        timeline.append({
            "type": "quiz",
            "label": f"Practice quiz: {q.title}",
            "at": at.isoformat(),
            "meta": {
                "score": float(a.score_percent) if a.score_percent is not None else None,
                "quiz_id": str(q.id),
            },
        })

    for a, q in mock_rows[:10]:
        at = a.submitted_at or a.started_at
        if not at:
            continue
        timeline.append({
            "type": "mock_exam",
            "label": f"Mock exam: {q.title}",
            "at": at.isoformat(),
            "meta": {
                "score": float(a.score_percent) if a.score_percent is not None else None,
                "quiz_id": str(q.id),
            },
        })

    for c in tutor_sessions[:5]:
        if not c.updated_at:
            continue
        timeline.append({
            "type": "tutor",
            "label": f"Study Assistant: {(c.title or 'Conversation')[:60]}",
            "at": c.updated_at.isoformat(),
            "meta": {"conversation_id": str(c.id)},
        })

    for p in payments[:5]:
        if not p.created_at:
            continue
        timeline.append({
            "type": "payment",
            "label": f"Payment: {float(p.amount):.0f} {p.currency} ({p.status.value})",
            "at": p.created_at.isoformat(),
            "meta": {
                "payment_id": str(p.id),
                "status": p.status.value,
                "amount": float(p.amount),
            },
        })

    timeline.sort(key=lambda x: x.get("at") or "", reverse=True)
    timeline = timeline[:40]

    def days_since(dt):
        if not dt:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, (now - dt).days)

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "university": getattr(user, "university", None),
            "year_of_study": getattr(user, "year_of_study", None),
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "subscription_tier": (
                user.subscription_tier.value
                if hasattr(user.subscription_tier, "value")
                else str(user.subscription_tier)
            ),
            "subscription_expires_at": (
                user.subscription_expires_at.isoformat()
                if getattr(user, "subscription_expires_at", None) else None
            ),
            "is_active": user.is_active,
            "email_verified": user.email_verified,
            "email_verified_at": (
                user.email_verified_at.isoformat()
                if getattr(user, "email_verified_at", None) else None
            ),
            "exam_date": (
                user.exam_date.isoformat()
                if getattr(user, "exam_date", None) else None
            ),
            "is_2fa_enabled": getattr(user, "is_2fa_enabled", False),
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_active": (
                user.last_active.isoformat()
                if getattr(user, "last_active", None) else None
            ),
            "ai_usage_count": getattr(user, "ai_usage_count", 0),
            "days_since_signup": days_since(user.created_at),
            "days_since_active": days_since(getattr(user, "last_active", None)),
        },
        "stats": {
            "quiz_attempts": len(quiz_rows),
            "quiz_avg_score": quiz_avg,
            "quiz_best_score": quiz_best,
            "mock_exams": len(mock_rows),
            "mock_avg_score": mock_avg,
            "mock_best_score": mock_best,
            "tutor_sessions": len(tutor_sessions),
            "tutor_messages": getattr(user, "ai_usage_count", 0),
            "payments_count": len(paid_payments),
            "payments_total": total_paid,
        },
        "subscription": (
            {
                "status": subscription.status.value if hasattr(subscription.status, "value") else None,
                "started_at": subscription.started_at.isoformat() if subscription.started_at else None,
                "expires_at": subscription.expires_at.isoformat() if subscription.expires_at else None,
                "plan_name": subscription.plan.name if subscription.plan else None,
            }
            if subscription
            else None
        ),
        "timeline": timeline,
    }