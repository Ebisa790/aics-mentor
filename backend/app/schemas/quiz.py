import datetime
import uuid
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.quiz import DifficultyLevel, QuestionType, QuizType


class QuestionCreate(BaseModel):
    course_id: uuid.UUID
    topic_id: uuid.UUID | None = None
    question_type: QuestionType
    difficulty: DifficultyLevel = DifficultyLevel.INTERMEDIATE
    prompt: str
    choices: dict[str, str] | None = None  # required for multiple_choice
    correct_answer: str
    explanation: str | None = None


class QuestionOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID | None = None
    question_type: QuestionType
    difficulty: DifficultyLevel
    prompt: str
    choices: dict[str, str] | None

    class Config:
        from_attributes = True


class QuestionWithAnswerOut(QuestionOut):
    """Used only after grading, to show the student the correct answer + explanation."""

    correct_answer: str
    explanation: str | None


class QuizCreate(BaseModel):
    title: str
    course_id: uuid.UUID | None = None
    quiz_type: QuizType = QuizType.DAILY_QUIZ
    time_limit_minutes: int | None = None
    question_ids: list[uuid.UUID]


class QuizOut(BaseModel):
    id: uuid.UUID
    title: str
    course_id: uuid.UUID | None = None
    quiz_type: QuizType
    time_limit_minutes: int | None
    question_count: int

    class Config:
        from_attributes = True


class QuizDetailOut(BaseModel):
    id: uuid.UUID
    title: str
    course_id: uuid.UUID | None = None
    quiz_type: QuizType
    time_limit_minutes: int | None
    questions: list[QuestionOut]

    @field_validator("course_id", mode="before")
    @classmethod
    def resolve_course_id(cls, v: Any, info: Any) -> Any:
        # If the quiz model directly has a course_id, use it
        if v is not None:
            return v

        # Fallback: extract course_id from the first question if available
        questions = info.data.get("questions") if hasattr(info, "data") else None
        if questions and len(questions) > 0:
            first_q = questions[0]
            if hasattr(first_q, "course_id"):
                return first_q.course_id
            elif isinstance(first_q, dict):
                return first_q.get("course_id")
        return None

    class Config:
        from_attributes = True


class QuizAnswerItem(BaseModel):
    question_id: uuid.UUID
    # Accepts either 'selected_answer' or 'student_answer' from frontend
    student_answer: str = Field(..., validation_alias="selected_answer")


class QuizSubmission(BaseModel):
    # Expects a list of QuizAnswerItem objects instead of dict[str, str]
    answers: list[QuizAnswerItem]


class QuestionResultDetail(QuestionWithAnswerOut):
    student_answer: str | None
    is_correct: bool


class QuizResultOut(BaseModel):
    score: int
    total_questions: int
    percentage: float
    details: list[QuestionResultDetail]

    class Config:
        from_attributes = True


class QuizAttemptOut(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    score: int
    total_questions: int
    percentage: float
    passed: bool
    submitted_at: datetime.datetime

    class Config:
        from_attributes = True