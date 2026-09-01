import uuid
from typing import List
import httpx

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_jti, get_current_user
from app.core.database import get_db
from app.models.user import User, UserDevice
from app.schemas.user import DeviceResponse, RevokeDeviceResponse, RevokeOthersResponse

router = APIRouter(prefix="/api/users/me/devices", tags=["Device Management"])


def _normalize_jti(jti_val: str | uuid.UUID | None) -> str:
    if not jti_val:
        return ""
    return str(jti_val).strip().strip('"').replace("-", "").lower()


async def _resolve_ip_location(ip_address: str) -> str:
    if not ip_address:
        return "Unknown Location"

    target_ip = ip_address.strip()

    if target_ip in ["127.0.0.1", "::1", "localhost"]:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get("https://api.ipify.org?format=json")
                target_ip = res.json().get("ip", target_ip)
        except Exception:
            return "Localhost (Development)"

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"http://ip-api.com/json/{target_ip}")
            data = res.json()
            if data.get("status") == "success":
                city = data.get("city", "")
                country = data.get("country", "")
                return f"{city}, {country}".strip(", ")
    except Exception:
        pass

    return target_ip


@router.get("", response_model=List[DeviceResponse])
async def list_user_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_jti: str = Depends(get_current_jti),
):
    """
    Retrieve all active device sessions for the authenticated user
    and clearly flag the currently active session.
    """
    devices = (
        db.query(UserDevice)
        .filter(
            UserDevice.user_id == current_user.id,
            UserDevice.is_revoked == False,
        )
        .order_by(UserDevice.last_active.desc())
        .all()
    )

    normalized_current_jti = _normalize_jti(current_jti)

    # Determine if any device directly matches the current JTI
    has_exact_match = any(_normalize_jti(d.session_jti) == normalized_current_jti for d in devices)

    result = []
    for index, d in enumerate(devices):
        db_jti = _normalize_jti(d.session_jti)

        # Flag current device: matches JTI OR fallback to most recent session if JTI lookup is ambiguous
        if has_exact_match:
            is_current = (db_jti == normalized_current_jti)
        else:
            is_current = (index == 0)

        resolved_location = d.ip_address or "Unknown Location"

        result.append(
            DeviceResponse(
                id=str(d.id),
                device_name=d.device_name,
                device_type=d.device_type,
                browser=d.browser,
                ip_address=resolved_location,
                last_active=d.last_active.isoformat() if hasattr(d.last_active, "isoformat") else str(d.last_active),
                is_current_device=is_current,
            )
        )

    return result


@router.delete("/{device_id}", response_model=RevokeDeviceResponse)
def revoke_device_session(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revoke a specific device session by ID.
    """
    query_id = device_id
    try:
        query_id = uuid.UUID(device_id)
    except (ValueError, TypeError):
        pass

    device = (
        db.query(UserDevice)
        .filter(
            UserDevice.id == query_id,
            UserDevice.user_id == current_user.id,
            UserDevice.is_revoked == False,
        )
        .first()
    )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device session not found or already revoked.",
        )

    device.is_revoked = True
    db.commit()

    return RevokeDeviceResponse(
        message="Device session revoked successfully.",
        revoked_device_id=str(device_id),
    )


@router.post("/revoke-others", response_model=RevokeOthersResponse)
def revoke_other_devices(
    current_user: User = Depends(get_current_user),
    current_jti: str = Depends(get_current_jti),
    db: Session = Depends(get_db),
):
    """
    Revoke all active sessions except the current active session.
    """
    target_jti = _normalize_jti(current_jti)

    all_active = (
        db.query(UserDevice)
        .filter(
            UserDevice.user_id == current_user.id,
            UserDevice.is_revoked == False,
        )
        .all()
    )

    revoked_count = 0
    for device in all_active:
        device_jti = _normalize_jti(device.session_jti)
        if device_jti != target_jti:
            device.is_revoked = True
            revoked_count += 1

    db.commit()

    return RevokeOthersResponse(
        message=f"Successfully signed out of {revoked_count} other device session(s).",
        revoked_count=revoked_count,
    )