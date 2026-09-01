from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler  # type: ignore # noqa: PLC2701
from slowapi.errors import RateLimitExceeded  # type: ignore
from slowapi.middleware import SlowAPIMiddleware  # type: ignore
from app.models.user import User,UserDevice # noqa
from app.core.config import settings
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

# Initialize Sentry (v2) (only if SENTRY_DSN is configured)
if getattr(settings, 'SENTRY_DSN', None):
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=1.0,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
    )
from app.core.rate_limit import limiter
from app.core.error_handlers import register_error_handlers
from app.core.logging_middleware import RequestLoggingMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.api.routes import (
    support,
    review_queue,
    question_management,
    admin,
    admin_users,
    payments,
    drills,
    ai,  
    devices,
    announcements,
    attempts,
    auth,
    courses,
    departments,
    exams,
    materials,
   
    quizzes,
    tutor,
    users,
)


def _validate_production_config() -> None:
    """Refuses to start with known-insecure defaults in production, rather than
    silently running with a forgeable JWT secret or an open Host header. This turns a
    'forgot to configure X' mistake into a startup crash instead of a live vulnerability."""
    if settings.ENVIRONMENT != "production":
        return
    if settings.SECRET_KEY == "dev-secret-change-me":
        raise RuntimeError(
            "ENVIRONMENT=production but SECRET_KEY is still the insecure default. "
            "Set a real, random SECRET_KEY (e.g. `openssl rand -hex 32`) before deploying."
        )
    if settings.ALLOWED_HOSTS == "*":
        raise RuntimeError(
            "ENVIRONMENT=production but ALLOWED_HOSTS is still '*' (any Host header accepted). "
            "Set it to your real domain(s), comma-separated, e.g. 'api.aicsmentor.et'."
        )
    if settings.FRONTEND_ORIGIN.startswith("http://localhost"):
        raise RuntimeError(
            "ENVIRONMENT=production but FRONTEND_ORIGIN still points at localhost. "
            "Set it to your real deployed frontend URL."
        )


_validate_production_config()

app = FastAPI(
    title="AI-CS Mentor API",
    description="AI Computer Science Exit Exam Mentor - Phase 1 MVP",
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_hosts = [h.strip() for h in settings.ALLOWED_HOSTS.split(",")] if settings.ALLOWED_HOSTS != "*" else ["*"]
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SlowAPIMiddleware)

register_error_handlers(app)

# Include API Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(departments.router)
app.include_router(courses.router)
app.include_router(materials.router)
app.include_router(quizzes.router)
app.include_router(quizzes.questions_router)
app.include_router(attempts.router)
app.include_router(payments.router)
app.include_router(tutor.router)
app.include_router(ai.router) 
app.include_router(admin.router)
app.include_router(question_management.router)
app.include_router(review_queue.router)
app.include_router(support.router)
app.include_router(exams.router)
app.include_router(admin_users.router) 
app.include_router(announcements.router)
app.include_router(drills.router, prefix="/api")
app.include_router(devices.router)
@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}