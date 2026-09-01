from functools import lru_cache

from groq import Groq

from app.core.config import settings

# Fallback model if settings.AI_MODEL is not explicitly set
FALLBACK_MODEL = "qwen/qwen3.6-27b"


@lru_cache(maxsize=1)
def get_groq_client() -> Groq | None:
    """
    Returns a cached Groq client instance, or None if no API key is configured.
    
    Using @lru_cache allows test suites to clear the cached client via 
    `get_groq_client.cache_clear()` after patching settings.
    """
    api_key = getattr(settings, "GROQ_API_KEY", None)
    if not api_key:
        return None
    return Groq(api_key=api_key)


def get_default_model() -> str:
    """
    Returns the configured AI model name, falling back to a stable Groq default.
    """
    return getattr(settings, "AI_MODEL", None) or FALLBACK_MODEL


DEFAULT_MODEL = get_default_model()