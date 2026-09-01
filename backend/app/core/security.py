import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import bcrypt
from fastapi import Request
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from user_agents import parse

from app.core.config import settings
from app.models.user import UserDevice

# Bcrypt silently ignores bytes beyond 72 bytes; reject early instead
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using bcrypt with explicit byte length verification.
    """
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > _BCRYPT_MAX_BYTES:
        raise ValueError(f"Password must be at most {_BCRYPT_MAX_BYTES} bytes long.")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored bcrypt hash.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), 
            hashed_password.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def generate_jti() -> str:
    """Utility to generate a consistent standard JTI string for device tracking sessions."""
    return str(uuid.uuid4())


def _create_token(
    subject: str, 
    expires_delta: timedelta, 
    token_type: Literal["access", "refresh", "reset"],
    jti: Optional[str] = None,
) -> str:
    """
    Encodes a JWT payload with standard security claims (sub, type, iat, exp, jti).
    Allows passing an explicit session JTI for device tracking.
    """
    now = datetime.now(timezone.utc)
    
    token_jti = str(jti).strip() if jti else generate_jti()

    payload = {
        "sub": str(subject),
        "type": token_type,
        "jti": token_jti,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str, jti: Optional[str] = None) -> str:
    """Generates a short-lived access token linked to a session JTI."""
    return _create_token(
        subject, 
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), 
        "access",
        jti=jti
    )


def create_refresh_token(subject: str, jti: Optional[str] = None) -> str:
    """Generates a long-lived refresh token linked to a session JTI."""
    return _create_token(
        subject, 
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), 
        "refresh",
        jti=jti
    )


def create_password_reset_token(subject: str) -> str:
    """Generates a short-lived password reset token (30 minutes)."""
    return _create_token(
        subject, 
        timedelta(minutes=30), 
        "reset"
    )


def decode_token(token: str) -> dict | None:
    """
    Decodes and validates a JWT token using the application SECRET_KEY.
    Returns the payload dictionary or None if invalid or expired.
    """
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def track_device_session(
    request: Request,
    user_id: str,
    session_jti: str,
    db: Session,
) -> UserDevice:
    """
    Parses request headers to log or update the active device session.
    Smart deduplication: If the same device (same type + browser + IP) logs in again,
    updates the existing record instead of creating a duplicate.
    """
    user_agent_str = request.headers.get("User-Agent", "")
    user_agent = parse(user_agent_str)

    # Determine device category
    if user_agent.is_mobile:
        device_type = "mobile"
    elif user_agent.is_tablet:
        device_type = "tablet"
    elif user_agent.is_pc:
        device_type = "desktop"
    else:
        device_type = "unknown"

    # Format human-readable names
    os_name = user_agent.os.family
    browser_name = f"{user_agent.browser.family} {user_agent.browser.version_string}".strip()
    
    device_family = user_agent.device.family
    if device_family and device_family != "Other":
        device_name = f"{os_name} ({device_family})"
    else:
        device_name = f"{os_name} Device"

    # Extract client IP (handling reverse proxies)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else "127.0.0.1"

    # Standardize session_jti
    clean_jti = str(session_jti).strip()

    # Convert user_id to UUID if it's a string
    try:
        user_uuid = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError):
        user_uuid = user_id

    # SMART DEDUPLICATION: Check if this exact device already exists for this user
    existing_device = (
        db.query(UserDevice)
        .filter(
            UserDevice.user_id == user_uuid,
            UserDevice.device_type == device_type,
            UserDevice.browser == browser_name,
            UserDevice.ip_address == ip_address,
            UserDevice.is_revoked == False,
        )
        .first()
    )

    if existing_device:
        # Same device detected - update existing record with new session
        existing_device.session_jti = clean_jti
        existing_device.last_active = datetime.now(timezone.utc)
        existing_device.ip_address = ip_address
        existing_device.is_revoked = False
        db.commit()
        db.refresh(existing_device)
        return existing_device

    # Also check by JTI (in case of token refresh)
    device_by_jti = db.query(UserDevice).filter(UserDevice.session_jti == clean_jti).first()

    if device_by_jti:
        # Update existing session
        device_by_jti.last_active = datetime.now(timezone.utc)
        device_by_jti.ip_address = ip_address
        device_by_jti.is_revoked = False
        db.commit()
        db.refresh(device_by_jti)
        return device_by_jti

    # Different device - create new record
    device = UserDevice(
        user_id=user_uuid,
        session_jti=clean_jti,
        device_name=device_name,
        device_type=device_type,
        browser=browser_name,
        ip_address=ip_address,
        last_active=datetime.now(timezone.utc),
        is_revoked=False,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device