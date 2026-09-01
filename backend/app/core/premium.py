"""
Premium access utility functions.
Centralized premium check logic for consistent enforcement.
"""
from datetime import datetime, timezone
from typing import Optional

from app.models.user import User, UserRole, SubscriptionTier


def is_premium_or_admin(user: User) -> bool:
    """
    Check if user has active premium subscription or is admin.
    Handles lifetime (NULL expires_at) and expiring subscriptions.
    """
    if not user:
        return False
    
    # Admin always has full access
    if user.role == UserRole.ADMIN:
        return True
    
    # Check premium status
    if user.subscription_tier == SubscriptionTier.PREMIUM:
        # If no expiry set, it's lifetime premium
        if not getattr(user, "subscription_expires_at", None):
            return True
        
        # Check if subscription has expired
        expires_at = user.subscription_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        return expires_at > now
    
    return False


def get_premium_status(user: User) -> dict:
    """
    Get detailed premium status for user.
    Useful for frontend display.
    """
    is_premium = is_premium_or_admin(user)
    
    status = {
        "is_premium": is_premium,
        "subscription_tier": user.subscription_tier.value if user.subscription_tier else "free",
        "is_admin": user.role == UserRole.ADMIN,
    }
    
    if is_premium and user.subscription_expires_at:
        status["expires_at"] = user.subscription_expires_at.isoformat()
        status["is_lifetime"] = False
    elif is_premium:
        status["is_lifetime"] = True
    
    return status


def truncate_content_for_preview(
    content: str, 
    is_premium: bool, 
    preview_percentage: float = 0.20
) -> tuple[str, bool]:
    """
    Truncate content for free users.
    Returns (content, is_preview).
    """
    if is_premium or not content:
        return content, False
    
    preview_length = int(len(content) * preview_percentage)
    truncated = content[:preview_length]
    
    # Add premium lock indicator
    truncated += "\n\n---\n\n> 🔒 **You're viewing 20% of this module**\n>\n> **Premium unlocks:**\n> - Complete definitions & explanations\n> - Exam traps & common mistakes\n> - Memory aids & mnemonics\n> - Quick revision summary\n>\n> **Upgrade to Premium to unlock the full guide.**"

    return truncated, True