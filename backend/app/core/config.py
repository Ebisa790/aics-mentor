from pydantic import field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore",
        case_sensitive=True,
    )

    # Database
    DATABASE_URL: str = "postgresql://aicsmentor:aicsmentor@localhost:5432/aicsmentor"

    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None

    # Auth & OAuth
    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_CLIENT_ID: str = ""

    # Environment & Host Guard
    ENVIRONMENT: str = "development"
    ALLOWED_HOSTS: str = "*"

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@aicsmentor.example"

    # AI (Groq Integration)
    GROQ_API_KEY: str = ""
    AI_MODEL: str = "llama-3.1-8b-instant"

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 20

    # ============================================================
    # CHAPA PAYMENT CONFIGURATION
    # ============================================================
    CHAPA_SECRET_KEY: str = ""  # CHAPA_SECRET_KEY from Chapa dashboard
    CHAPA_API_URL: str = "https://api.chapa.co/v1"
    CHAPA_WEBHOOK_SECRET: str = ""  # Optional: HMAC secret for webhook verification
    
    # Payment URLs
    CHAPA_CALLBACK_URL: str = ""  # Server-to-server webhook URL
    CHAPA_RETURN_URL: str = ""    # Frontend return URL after payment
    
    # Default pricing (can be overridden by admin in database)
    DEFAULT_PREMIUM_PRICE: float = 500.00
    DEFAULT_PREMIUM_CURRENCY: str = "ETB"
    
    # Mock payment mode for development
    MOCK_PAYMENT: bool = False
    
    # Sentry error monitoring
    SENTRY_DSN: str = ""

    @property
    def is_production(self) -> bool:
        """Returns True if running in a production environment."""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def effective_celery_broker(self) -> str:
        """Resolves Celery broker URL, defaulting to REDIS_URL if unconfigured."""
        return self.CELERY_BROKER_URL or self.REDIS_URL

    @property
    def effective_celery_backend(self) -> str:
        """Resolves Celery result backend URL, defaulting to REDIS_URL if unconfigured."""
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL

    @property
    def cors_origins(self) -> list[str]:
        """Parses comma-separated FRONTEND_ORIGIN into a list for CORSMiddleware."""
        return [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]

    @property
    def allowed_hosts_list(self) -> list[str]:
        """Parses comma-separated ALLOWED_HOSTS into a list for TrustedHostMiddleware."""
        return [host.strip() for host in self.ALLOWED_HOSTS.split(",") if host.strip()]

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info: ValidationInfo) -> str:
        """Prevents using the default dev secret key when environment is set to production."""
        env = info.data.get("ENVIRONMENT", "development")
        if env.lower() == "production" and v == "dev-secret-change-me":
            raise ValueError(
                "SECRET_KEY must be changed from the default development value in production mode!"
            )
        return v
    
    @field_validator("CHAPA_SECRET_KEY")
    @classmethod
    def validate_chapa_secret_key(cls, v: str, info: ValidationInfo) -> str:
        """Ensures Chapa secret key is set in production."""
        env = info.data.get("ENVIRONMENT", "development")
        if env.lower() == "production" and not v:
            raise ValueError(
                "CHAPA_SECRET_KEY must be set in production environment!"
            )
        return v


settings = Settings()