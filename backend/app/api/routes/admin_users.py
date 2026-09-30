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
