"""Schemas for Exam Blueprint responses."""
from typing import Optional
from pydantic import BaseModel, ConfigDict
import uuid


class ExamBlueprintItemOut(BaseModel):
    id: uuid.UUID
    theme: str
    course_name: str
    credit_hours: int
    test_items: int
    cognitive_remember: int
    cognitive_understand: int
    cognitive_apply: int
    cognitive_analyze: int
    cognitive_evaluate: int
    cognitive_create: int
    course_id: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True)


class BlueprintSummary(BaseModel):
    """Aggregate view for the exam."""
    total_items: int
    total_courses: int
    total_themes: int
    cognitive_totals: dict[str, int]


class ExamBlueprintResponse(BaseModel):
    summary: BlueprintSummary
    items: list[ExamBlueprintItemOut]