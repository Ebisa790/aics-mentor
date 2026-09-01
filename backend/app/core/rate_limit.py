import logging
import redis
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_real_client_ip(request: Request) -> str:
    """
    Extracts the true client IP address, handling reverse proxies,
    load balancers, and Cloudflare headers.
    """
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()

    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    return get_remote_address(request)


def get_active_storage_uri() -> str:
    """
    Verifies Redis connection if configured.
    Falls back to in-memory storage if Redis is unavailable or unreachable.
    """
    redis_url = getattr(settings, "REDIS_URL", None)

    if redis_url:
        try:
            # Quick health check with a 1-second timeout
            r = redis.from_url(redis_url, socket_connect_timeout=1)
            r.ping()
            logger.info("Rate limiter successfully connected to Redis backend.")
            return redis_url
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
            logger.warning(
                "Redis configured at %s but unreachable (%s). Falling back to in-memory rate limiting.",
                redis_url,
                e,
            )

    logger.info("Rate limiter using in-memory backend (memory://).")
    return "memory://"


# Initialize limiter with verified storage URI
limiter = Limiter(
    key_func=get_real_client_ip,
    storage_uri=get_active_storage_uri(),
)