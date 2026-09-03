import hashlib
import pyotp
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.core.email import send_password_reset_email, send_welcome_email
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_jti,
    hash_password,
    track_device_session,
    verify_password,
)
from app.models.password_reset import PasswordResetToken
from app.models.user import UserDevice
from app.models.user import SubscriptionTier, User, UserRole
from app.schemas.user import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleLoginRequest,
    ResetPasswordRequest,
    Token,
    UserOut,
    UserRegister,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TOKEN_EXPIRE_MINUTES = 30
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def _get_device_type_from_request(request: Request) -> str:
    """Detect device type from User-Agent header."""
    user_agent = request.headers.get("User-Agent", "").lower()
    
    if "mobile" in user_agent or "android" in user_agent or "iphone" in user_agent:
        return "mobile"
    elif "tablet" in user_agent or "ipad" in user_agent:
        return "tablet"
    else:
        return "desktop"


def _enforce_device_type_limit(user: User, request: Request, db: Session) -> None:
    """
    Enforce device limits:
    - Max 2 devices
    - Must be DIFFERENT types (e.g., desktop + mobile, not desktop + desktop)
    """
    from app.core.email import send_email_async
    
    max_devices = 2
    
    # Get current device type from request
    current_device_type = _get_device_type_from_request(request)
    
    # Get active devices
    active_devices = (
        db.query(UserDevice)
        .filter(
            UserDevice.user_id == user.id,
            UserDevice.is_revoked == False,
        )
        .order_by(UserDevice.last_active.desc())
        .all()
    )
    
    # Check if same device type already active
    same_type_devices = [
        d for d in active_devices 
        if d.device_type == current_device_type
    ]
    
    if same_type_devices:
        # Revoke old same-type device (keep only one per type)
        for device in same_type_devices:
            device.is_revoked = True
        db.commit()
        
        # Send notification
        device_label = current_device_type.replace("_", " ").title()
        subject = "Device Type Conflict - ExitAI Ethiopia"
        body_text = f"""Hi {user.full_name},

A login was detected from another {device_label} device.

Only one {device_label} can be active at a time.
Your previous {device_label} session was logged out.

Allowed combinations:
- Desktop + Phone
- Desktop + Tablet
- Phone + Tablet

If this was you, no action needed.
If this was NOT you, change your password immediately.

ExitAI Ethiopia Team
"""
        send_email_async(to_email=user.email, subject=subject, body_text=body_text)
    
    # Check if max devices reached (after revoking same type)
    remaining_devices = (
        db.query(UserDevice)
        .filter(
            UserDevice.user_id == user.id,
            UserDevice.is_revoked == False,
        )
        .count()
    )
    
    if remaining_devices >= max_devices:
        # Revoke oldest device
        oldest_devices = (
            db.query(UserDevice)
            .filter(
                UserDevice.user_id == user.id,
                UserDevice.is_revoked == False,
            )
            .order_by(UserDevice.last_active.asc())
            .limit(remaining_devices - max_devices + 1)
            .all()
        )
        
        for device in oldest_devices:
            device.is_revoked = True
        db.commit()
        
        # Send notification
        subject = "New Device Login - ExitAI Ethiopia"
        body_text = f"""Hi {user.full_name},

A new login was detected from a different device.

For security, each account can have {max_devices} devices of different types.
Your oldest device was logged out.

If this was you, no action needed.
If this was NOT you, change your password immediately.

ExitAI Ethiopia Team
"""
        send_email_async(to_email=user.email, subject=subject, body_text=body_text)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("15/minute")
def register(request: Request, payload: UserRegister, db: Session = Depends(get_db)):
    """
    Registers a new student.
    By default, sets role to STUDENT and subscription_tier to FREE.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="An account with this email already exists"
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        university=payload.university,
        year_of_study=payload.year_of_study,
        role=UserRole.STUDENT,
        subscription_tier=SubscriptionTier.FREE,
        ai_usage_count=0,
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send welcome email
    send_welcome_email(to_email=user.email, full_name=user.full_name)
    
    return user


@router.post("/login")
@limiter.limit("15/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    now_utc = datetime.now(timezone.utc)

    # Generic credential error to avoid email enumeration
    invalid_credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, 
        detail="Incorrect email or password"
    )

    if not user:
        raise invalid_credentials_exception

    # Check if account is deactivated
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Please contact support to reactivate your account."
        )

    # 1. Check if account is locked out due to repeated failed attempts
    locked_until = getattr(user, "locked_until", None)
    if locked_until:
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
            
        if now_utc < locked_until:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is temporarily locked due to failed login attempts. Try again later."
            )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Account is disabled"
        )

    # 2. Verify password & track brute-force lockouts
    if not verify_password(form_data.password, user.hashed_password):
        if hasattr(user, "failed_login_attempts"):
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
                user.locked_until = now_utc + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            db.commit()
        raise invalid_credentials_exception

    # Reset failed attempts on successful authentication
    if hasattr(user, "failed_login_attempts") and user.failed_login_attempts > 0:
        user.failed_login_attempts = 0
        user.locked_until = None
    
    # Update last_active
    user.last_active = datetime.now(timezone.utc)
    db.commit()

    # ENFORCE DEVICE TYPE LIMIT: Max 2 devices, must be different types
    _enforce_device_type_limit(user, request, db)

    # Check if 2FA is enabled and device is trusted
    if user.is_2fa_enabled:
        trusted_device = (
            db.query(UserDevice)
            .filter(
                UserDevice.user_id == user.id,
                UserDevice.is_trusted == True,
                UserDevice.trusted_until > now_utc,
                UserDevice.is_revoked == False,
            )
            .first()
        )
        
        if not trusted_device:
            return {
                "requires_2fa": True,
                "email": user.email,
                "message": "2FA code required. Use /api/auth/2fa/login-verify to complete login."
            }

    # Single canonical JTI for this login session
    session_jti = generate_jti()

    # Log device session
    track_device_session(
        request=request,
        user_id=str(user.id),
        session_jti=session_jti,
        db=db,
    )

    return Token(
        access_token=create_access_token(subject=str(user.id), jti=session_jti),
        refresh_token=create_refresh_token(subject=str(user.id), jti=session_jti),
    )


@router.post("/google", response_model=Token)
@limiter.limit("15/minute")
def google_login(request: Request, payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates or registers a user via Google OAuth ID token.
    Validates the token against Google APIs and returns standard JWT tokens.
    """
    print(f"DEBUG: GOOGLE_CLIENT_ID from settings = {repr(settings.GOOGLE_CLIENT_ID)}")
    if not getattr(settings, "GOOGLE_CLIENT_ID", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_ID is not configured on the server."
        )

    try:
        id_info = id_token.verify_oauth2_token(
            payload.id_token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google authentication token"
        )

    email = id_info.get("email")
    full_name = id_info.get("name", "")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not provide a verified email address"
        )

    user = db.query(User).filter(User.email == email).first()

    if not user:
        random_pwd = secrets.token_urlsafe(32)
        user = User(
            email=email,
            hashed_password=hash_password(random_pwd),
            full_name=full_name,
            role=UserRole.STUDENT,
            subscription_tier=SubscriptionTier.FREE,
            ai_usage_count=0,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    if hasattr(user, "failed_login_attempts") and user.failed_login_attempts > 0:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    # ENFORCE DEVICE TYPE LIMIT for Google login too
    _enforce_device_type_limit(user, request, db)

    session_jti = generate_jti()
    track_device_session(
        request=request,
        user_id=str(user.id),
        session_jti=session_jti,
        db=db,
    )

    return Token(
        access_token=create_access_token(subject=str(user.id), jti=session_jti),
        refresh_token=create_refresh_token(subject=str(user.id), jti=session_jti),
    )


@router.post("/refresh", response_model=Token)
def refresh(refresh_token: str, db: Session = Depends(get_db)):
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid or expired refresh token"
        )

    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid refresh token"
        )

    jti = str(payload.get("jti")).strip() if payload.get("jti") else generate_jti()

    if payload.get("jti"):
        try:
            active = db.execute(
                text("SELECT 1 FROM device_sessions WHERE user_id = :u AND session_jti = :jti"),
                {"u": str(user.id), "jti": jti}
            ).first()
            if not active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been revoked. Please log in again."
                )
        except Exception:
            pass

    return Token(
        access_token=create_access_token(subject=str(user.id), jti=jti),
        refresh_token=create_refresh_token(subject=str(user.id), jti=jti),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile with premium status."""
    return current_user


@router.get("/premium-status")
def get_premium_status_endpoint(current_user: User = Depends(get_current_user)):
    """Get detailed premium status for current user."""
    from app.core.premium import get_premium_status
    return get_premium_status(current_user)


# ============================== 2FA Endpoints ==============================

@router.post("/2fa/setup")
def setup_2fa(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled for this account.")

    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    db.commit()

    otpauth_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email,
        issuer_name="ExitAI Ethiopia"
    )

    return {
        "secret": secret,
        "otpauth_uri": otpauth_uri,
        "message": "Scan the QR code with Google Authenticator or enter the secret manually."
    }


@router.post("/2fa/verify")
def verify_2fa_setup(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = payload.get("code", "")
    
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated. Call /api/auth/2fa/setup first.")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(code, valid_window=2):
        raise HTTPException(status_code=400, detail="Invalid 2FA code. Please try again.")

    current_user.is_2fa_enabled = True
    db.commit()

    return {"message": "2FA enabled successfully!"}


@router.post("/2fa/disable")
def disable_2fa(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = payload.get("code", "")
    
    if not current_user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled for this account.")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid 2FA code. Cannot disable 2FA.")

    current_user.is_2fa_enabled = False
    current_user.totp_secret = None
    db.commit()

    return {"message": "2FA disabled successfully."}


@router.post("/2fa/email/send")
def send_email_2fa(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
):
    email = payload.get("email")
    password = payload.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required.")

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    import random
    code = str(random.randint(100000, 999999))
    
    setattr(user, 'email_2fa_code', code)
    setattr(user, 'email_2fa_expires', datetime.now(timezone.utc) + timedelta(minutes=10))
    db.commit()

    from app.core.email import send_email_async
    send_email_async(
        to_email=user.email,
        subject="Your ExitAI Ethiopia 2FA Code",
        body_text=f"Your 2FA code is: {code}. This code expires in 10 minutes."
    )

    return {"message": "2FA code sent to your email."}


@router.post("/2fa/email/verify")
def verify_email_2fa(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
):
    email = payload.get("email")
    code = payload.get("code")
    trust_device = payload.get("trust_device", False)

    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and code required.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email.")

    stored_code = getattr(user, 'email_2fa_code', None)
    expires_at = getattr(user, 'email_2fa_expires', None)
    
    if not stored_code or stored_code != code:
        raise HTTPException(status_code=401, detail="Invalid 2FA code.")
    
    if expires_at and datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=401, detail="2FA code expired. Please request a new one.")

    setattr(user, 'email_2fa_code', None)
    setattr(user, 'email_2fa_expires', None)
    db.commit()

    session_jti = generate_jti()
    track_device_session(
        request=request,
        user_id=str(user.id),
        session_jti=session_jti,
        db=db,
    )

    if trust_device:
        now_utc = datetime.now(timezone.utc)
        device = db.query(UserDevice).filter(UserDevice.session_jti == session_jti).first()
        if device:
            device.is_trusted = True
            device.trusted_until = now_utc + timedelta(days=30)
            db.commit()

    return Token(
        access_token=create_access_token(subject=str(user.id), jti=session_jti),
        refresh_token=create_refresh_token(subject=str(user.id), jti=session_jti),
    )


@router.post("/2fa/login-verify")
def verify_2fa_login(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
):
    email = payload.get("email")
    code = payload.get("code")
    password = payload.get("password")

    if not email or not code or not password:
        raise HTTPException(status_code=400, detail="Email, password, and 2FA code are required.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    if not user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled for this account.")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code.")

    trust_device = payload.get("trust_device", False)
    
    session_jti = generate_jti()
    track_device_session(
        request=request,
        user_id=str(user.id),
        session_jti=session_jti,
        db=db,
    )
    
    if trust_device:
        now_utc = datetime.now(timezone.utc)
        device = db.query(UserDevice).filter(UserDevice.session_jti == session_jti).first()
        if device:
            device.is_trusted = True
            device.trusted_until = now_utc + timedelta(days=30)
            db.commit()

    return Token(
        access_token=create_access_token(subject=str(user.id), jti=session_jti),
        refresh_token=create_refresh_token(subject=str(user.id), jti=session_jti),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("10/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    generic_message = "If an account exists for that email, a password reset link has been sent."
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        return ForgotPasswordResponse(message=generic_message)

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    reset_link = f"{settings.FRONTEND_ORIGIN}/reset-password?token={raw_token}"
    try:
        send_password_reset_email(user.email, reset_link)
    except Exception:
        pass

    dev_token = None
    if settings.ENVIRONMENT != "production" and not settings.SMTP_HOST:
        dev_token = raw_token

    return ForgotPasswordResponse(message=generic_message, dev_reset_token=dev_token)


@router.post("/reset-password", response_model=UserOut)
@limiter.limit("15/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    from app.core.database import SessionLocal
    from sqlalchemy import text as sql_text
    
    db.close()
    db = SessionLocal()
    
    try:
        token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
        now_utc = datetime.now(timezone.utc)

        reset_token = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now_utc,
            )
            .first()
        )
        if not reset_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="This reset link is invalid or has expired."
            )

        user = db.get(User, reset_token.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="This reset link is invalid or has expired."
            )

        user.hashed_password = hash_password(payload.new_password)
        if hasattr(user, "failed_login_attempts"):
            user.failed_login_attempts = 0
            user.locked_until = None

        reset_token.used_at = now_utc

        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
        ).update({"used_at": now_utc})

        try:
            db.execute(
                sql_text("DELETE FROM device_sessions WHERE user_id = :u"),
                {"u": str(user.id)}
            )
        except Exception:
            db.rollback()
            pass

        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Password reset failed: {str(e)}")
    finally:
        db.close()


@router.post("/delete-account")
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_email = current_user.email
    current_user.is_active = False
    db.commit()
    
    return {
        "message": "Your account has been deactivated. You can contact support to reactivate your account if needed.",
        "email": user_email
    }