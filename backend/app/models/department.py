import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import String, Text, DateTime, Boolean, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.course import Course


class Department(Base):
    """
    Degree program entity (e.g., 'BSc Computer Science').
    Enables expanding to other academic departments via admin controls.
    """

    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)  # e.g. "Computer Science"
    short_name: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True
    )  # e.g. "CS"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False,
    )

    # Relationships using string references to prevent circular import warnings
    courses: Mapped[List["Course"]] = relationship(
        "Course", back_populates="department", cascade="all, delete-orphan"
    )