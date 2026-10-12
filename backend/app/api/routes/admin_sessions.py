"""
Admin session management.

Lists all active sessions across the platform and lets an admin
revoke any session (except their own current one).
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserDevice, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin",
    tags=["admin-sessions"],
    dependencies=[Depends(require_admin)],
)


def _get_current_jti(request: Request) -> str | None:
    """Extract the session_jti from the caller's bearer token, if any."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = decode_token(auth[7:])
        if not payload:
            return None
        jti = payload.get("jti")
        return str(jti) if jti else None
    except Exception:
        return None


@router.get("/sessions")
def list_active_sessions(
    request: Request,
    role: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List all active (non-revoked) sessions across the platform.
    Optional `role` filter: "admin" or "student".
    """
    q = (
        db.query(UserDevice, User)
        .join(User, User.id == UserDevice.user_id)
        .filter(UserDevice.is_revoked.is_(False))
    )

    if role:
        try:
            q = q.filter(User.role == UserRole(role.lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role filter")

    rows = q.order_by(desc(UserDevice.last_active)).limit(500).all()
    current_jti = _get_current_jti(request)

    sessions = []
    for device, user in rows:
        sessions.append({
            "id": str(device.id),
            "session_jti": device.session_jti,
            "user": {
                "id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            },
            "device_name": device.device_name,
            "device_type": device.device_type,
            "browser": device.browser,
            "ip_address": device.ip_address,
            "last_active": device.last_active.isoformat() if device.last_active else None,
            "is_trusted": bool(device.is_trusted),
            "is_current": bool(current_jti and device.session_jti == current_jti),
        })

    return sessions


@router.delete("/sessions/{device_id}")
def revoke_session(
    device_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """
    Revoke a session. The user will be forced to log in again.
    A guard prevents an admin from revoking their own current session.
    """
    device = db.get(UserDevice, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Session not found")

    if device.is_revoked:
        return {"success": True, "message": "Session already revoked"}

    current_jti = _get_current_jti(request)
    if current_jti and device.session_jti == current_jti:
        raise HTTPException(
            status_code=400,
            detail="You cannot revoke your own current session.",
        )

    device.is_revoked = True
    db.commit()

    user = db.get(User, device.user_id)
    logger.info(
        f"Admin {current_admin.id} revoked session {device.id} "
        f"for user {user.email if user else 'unknown'}"
    )

    return {"success": True, "revoked_session_id": str(device.id)}