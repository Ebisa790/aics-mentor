import uuid

from pydantic import BaseModel, Field, ConfigDict


# ---------- Department Schemas ----------


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Full department name")
    short_name: str | None = Field(None, max_length=50, description="Abbreviated code, e.g., 'CS'")
    description: str | None = Field(None, description="Department description")


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    short_name: str | None
    description: str | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ---------- Topic Schemas ----------


class TopicCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255, description="Subtopic domain title")
    description: str | None = Field(None, description="Topic description or scope")
    order_index: int = Field(0, ge=0, description="Display sequencing order")


class TopicUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    order_index: int | None = Field(None, ge=0)


class TopicOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    order_index: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Course Schemas ----------


class CourseCreate(BaseModel):
    department_id: uuid.UUID = Field(..., description="Parent department ID")
    name: str = Field(min_length=1, max_length=255, description="Course title or subject area name")
    code: str | None = Field(None, max_length=20, description="Official curriculum code, e.g., 'CoSc2092'")
    category: str = Field(..., max_length=255, description="Exam theme category")
    description: str | None = Field(None, description="Comprehensive course syllabus overview")
    ects_credits: int | None = Field(None, ge=1, le=30, description="ECTS credit allocation")
    order_index: int = Field(0, ge=0, description="Departmental display order index")


class CourseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    code: str | None = Field(None, max_length=20)
    description: str | None = None
    category: str | None = Field(None, max_length=255)
    department_id: uuid.UUID | None = None
    ects_credits: int | None = Field(None, ge=1, le=30)
    order_index: int | None = Field(None, ge=0)


class CourseOut(BaseModel):
    id: uuid.UUID
    department_id: uuid.UUID
    name: str
    code: str | None
    category: str
    description: str | None
    ects_credits: int | None
    order_index: int
    question_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CourseDetailOut(CourseOut):
    topics: list[TopicOut] = Field(default_factory=list, description="Associated learning subtopics")