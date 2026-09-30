"""
Blocklist of known disposable / throwaway email domains.
"""
DISPOSABLE_EMAIL_DOMAINS: set[str] = {
    "mailinator.com",
    "guerrillamail.com",
    # ... rest of the list
}

def is_disposable_email(email: str) -> bool:
    if not email or "@" not in email:
        return True
    domain = email.rsplit("@", 1)[-1].strip().lower()
    return domain in DISPOSABLE_EMAIL_DOMAINS