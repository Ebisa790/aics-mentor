from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# Clean up DATABASE_URL to ensure standard synchronous drivers are used
db_url = settings.DATABASE_URL
if "+asyncpg" in db_url:
    db_url = db_url.replace("+asyncpg", "")
elif "+aiosqlite" in db_url:
    db_url = db_url.replace("+aiosqlite", "")

# Base engine configurations
engine_kwargs = {
    "pool_pre_ping": True,  # Verifies connection health before executing queries
}

# Apply SQLite specific threading fixes or PostgreSQL production pool tuning
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update(
        {
            "pool_size": 10,       # Persistent pool connections
            "max_overflow": 20,    # Additional temporary connections under spike load
            "pool_recycle": 1800,  # Recycle connections older than 30 minutes
        }
    )

engine = create_engine(db_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """
    Base ORM class for all database models using SQLAlchemy 2.0 standard.
    """
    pass


def get_db():
    """
    FastAPI dependency yielding a database session per request 
    and guaranteeing cleanup upon completion.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()