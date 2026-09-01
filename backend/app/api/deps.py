import uuid

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole, UserDevice, SubscriptionTier

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_jti(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> str:
    """
    Extracts and validates the JTI (JWT ID) claim from the active Bearer token,
    and ensures the corresponding device session has not been revoked.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_exception

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure: missing session JTI",
        )

    clean_jti = str(jti).strip().strip('"')

    # Verify session is still active in DB
    device_session = (
        db.query(UserDevice)
        .filter(
            UserDevice.session_jti == clean_jti,
            UserDevice.is_revoked == False,
        )
        .first()
    )

    if not device_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or is no longer active",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return clean_jti


def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """
    Validates JWT access token, checks for revoked device sessions,
    verifies active account status, and returns the authenticated User instance.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_exception

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    user_id_str = payload.get("sub")
    jti = payload.get("jti")

    if user_id_str is None or jti is None:
        raise credentials_exception

    try:
        user_id = uuid.UUID(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception

    # Session Revocation Check: If user revoked this session elsewhere, block access
    device = (
        db.query(UserDevice)
        .filter(UserDevice.session_jti == str(jti), UserDevice.user_id == user_id)
        .first()
    )
    if device and device.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive account. Please contact system administrator."
        )
    
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Role Guard: Verifies that the authenticated user possesses Administrator privileges.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin access required"
        )
    return current_user


def require_premium(current_user: User = Depends(get_current_user)) -> User:
    """
    Tier Guard: Verifies that the authenticated user possesses an active Premium subscription.
    """
    if current_user.subscription_tier != SubscriptionTier.PREMIUM:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required to access this feature."
        )
    return current_user


def get_current_user_optional(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """
    Get current user if authenticated, returns None if not.
    Does NOT check if user is active - allows deactivated users.
    This version does NOT require authentication.
    """
    if authorization is None or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Use the existing decode_token function
        payload = decode_token(token)
        if payload is None:
            return None
        
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        # Convert to UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except (ValueError, TypeError):
            return None
        
        user = db.get(User, user_uuid)
        return user
    except Exception:
        return None