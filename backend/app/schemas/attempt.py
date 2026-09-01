from typing import Any
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict

from app.models.attempt import AttemptStatus
from app.schemas.quiz import QuestionWithAnswerOut


class AttemptStart(BaseModel):
    """
    Payload to initialize a new quiz or mock exam attempt session.
    """
    quiz_id: uuid.UUID = Field(..., description="Unique identifier of the target quiz")


from pydantic import BaseModel, Field, ConfigDict, model_validator

class AnswerSubmit(BaseModel):
    """
    Payload for submitting an individual question response.
    """
    question_id: uuid.UUID = Field(..., description="Unique identifier of the question")
    student_answer: str = Field("", max_length=1000, description="Submitted answer option or response text")

    @model_validator(mode="before")
    @classmethod
    def fallback_answer_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Extract answer if sent under alternative frontend key names
            if not data.get("student_answer"):
                alt = data.get("answer") or data.get("selected_option") or data.get("choice") or ""
                data["student_answer"] = str(alt)
        return data


class AttemptSubmit(BaseModel):
    """
    Payload for submitting all question answers to conclude an active exam attempt.
    """
    answers: list[AnswerSubmit] = Field(default_factory=list, description="Collection of responses for grading")


class GradedAnswerOut(BaseModel):
    question: QuestionWithAnswerOut
    student_answer: str
    is_correct: bool
    ai_feedback: str | None = Field(None, description="Targeted AI explanation or guidance for incorrect answers")

    model_config = ConfigDict(from_attributes=True)


class AttemptResultOut(BaseModel):
    id: uuid.UUID
    status: AttemptStatus
    score_percent: float = Field(..., ge=0.0, le=100.0, description="Final calculated score percentage (0-100)")
    submitted_at: datetime | None
    late_submission: bool
    graded_answers: list[GradedAnswerOut] = Field(default_factory=list, description="Comprehensive list of graded questions")
    weak_topics: list[str] = Field(default_factory=list, description="AI-identified topics requiring additional review")

    model_config = ConfigDict(from_attributes=True)