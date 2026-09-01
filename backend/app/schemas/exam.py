import uuid
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


class GenerateExamRequest(BaseModel):
    """
    Payload for requesting a dynamically generated quiz or mock exam.
    """
    mode: Literal["practice", "mock"] = Field(
        ..., description="Generation tier mode: 'practice' (untimed, AI feedback) or 'mock' (timed simulation)"
    )
    course_id: uuid.UUID | None = Field(
        None, description="Target course ID, or None for comprehensive global multi-course mock exams"
    )
    num_questions: int = Field(
        10, ge=1, le=200, description="Total number of questions to generate for the assessment"
    )
    question_count: int | None = Field(
        None, ge=1, le=200, description="Alias for num_questions (frontend compatibility)"
    )


class GenerateExamResponse(BaseModel):
    """
    Response returned after successfully creating and populating a generated exam instance.
    """
    quiz_id: uuid.UUID = Field(..., description="Unique identifier of the newly created quiz")
    mode: Literal["practice", "mock"] = Field(..., description="Exam mode used for generation")
    question_count: int = Field(..., description="Total number of questions successfully bound to the quiz")
    time_limit_minutes: int | None = Field(..., description="Allocated time limit in minutes, if applicable")

    model_config = ConfigDict(from_attributes=True)