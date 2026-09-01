from celery import Celery
from app.core.config import settings

DEFAULT_REDIS_URL = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "exitai_worker",
    broker=getattr(settings, "CELERY_BROKER_URL", DEFAULT_REDIS_URL),
    backend=getattr(settings, "CELERY_RESULT_BACKEND", DEFAULT_REDIS_URL),
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    result_expires=3600,
)

# FORCED IMPORTS: Guarantees task registration regardless of discovery settings
import app.tasks.master_takes  # noqa
