import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.material import MaterialSource, MaterialStatus


class MaterialOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID | None
    topic_id: uuid.UUID | None
    title: str
    file_type: str
    source: MaterialSource
    status: MaterialStatus
    is_public: bool
    created_at: datetime

    class Config:
        from_attributes = True
