import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.models.course_material import MaterialContentType
from app.models.exam_question import ExamDifficulty, ReviewStatus
from app.models.quiz import DifficultyLevel, QuestionType


# ---------- Course materials (admin-authored Markdown) ----------


class CourseMaterialCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255, description="Title of the learning material")
    content: str = Field(min_length=1, description="Markdown content for the material")
    material_type: MaterialContentType = Field(MaterialContentType.NOTE, description="Category of the material")
    is_ai_generated: bool = Field(False, description="Flag indicating if the content was drafted by AI")


class CourseMaterialUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    content: str | None = Field(None, min_length=1)
    material_type: MaterialContentType | None = None


class CourseMaterialOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    content: str
    material_type: MaterialContentType
    is_ai_generated: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Exam questions (admin MCQ bank + QA workflow) ----------


class ExamQuestionCreate(BaseModel):
    question_text: str = Field(min_length=1)
    option_a: str = Field(min_length=1)
    option_b: str = Field(min_length=1)
    option_c: str = Field(min_length=1)
    option_d: str = Field(min_length=1)
    correct_option: Literal["A", "B", "C", "D"]
    explanation: str = Field(min_length=1)
    difficulty: ExamDifficulty = ExamDifficulty.MEDIUM
    is_ai_generated: bool = False
    ai_topic: str | None = Field(None, description="Prompt or topical context used during AI generation")


class ExamQuestionUpdate(BaseModel):
    question_text: str | None = None
    option_a: str | None = None
    option_b: str | None = None
    option_c: str | None = None
    option_d: str | None = None
    correct_option: Literal["A", "B", "C", "D"] | None = None
    explanation: str | None = None
    difficulty: ExamDifficulty | None = None


class ExamQuestionOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str
    difficulty: ExamDifficulty
    is_ai_generated: bool
    review_status: ReviewStatus
    ai_model: str | None
    ai_topic: str | None
    reviewed_by_id: uuid.UUID | None
    reviewed_at: datetime | None
    rejection_reason: str | None
    promoted_question_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewAction(BaseModel):
    action: Literal["approve", "reject", "archive"] = Field(..., description="QA moderation action")
    rejection_reason: str | None = Field(None, description="Mandatory rationale if rejecting")

    @model_validator(mode="after")
    def _reason_required_for_rejection(self):
        if self.action == "reject" and not (self.rejection_reason and self.rejection_reason.strip()):
            raise ValueError("rejection_reason is required when rejecting a question")
        return self


# ---------- AI drafting ----------


class AIGenerateRequest(BaseModel):
    course_id: uuid.UUID
    type: Literal["question", "note"]
    topic: str = Field(min_length=1, max_length=300)
    difficulty: ExamDifficulty = ExamDifficulty.MEDIUM
    material_type: MaterialContentType = MaterialContentType.NOTE


class AINoteDraft(BaseModel):
    title: str
    content: str


class AIQuestionDraft(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: Literal["A", "B", "C", "D"]
    explanation: str


class AIGenerateResponse(BaseModel):
    type: Literal["question", "note"]
    note: AINoteDraft | None = None
    question: AIQuestionDraft | None = None

    @model_validator(mode="after")
    def _exactly_one_payload(self):
        has_note = self.note is not None
        has_question = self.question is not None
        if has_note == has_question:
            raise ValueError("Exactly one of 'note' or 'question' must be set")
        if self.type == "note" and not has_note:
            raise ValueError("type is 'note' but no note draft was produced")
        if self.type == "question" and not has_question:
            raise ValueError("type is 'question' but no question draft was produced")
        return self


# ---------- Bulk question-bank import ----------


class BulkQuestionRow(BaseModel):
    """A single question for bulk CSV/JSON import into the course's active Question bank."""

    question_type: QuestionType = QuestionType.MULTIPLE_CHOICE
    difficulty: DifficultyLevel = DifficultyLevel.INTERMEDIATE
    prompt: str = Field(min_length=1)
    option_a: str | None = None
    option_b: str | None = None
    option_c: str | None = None
    option_d: str | None = None
    choices: dict[str, str] | None = None
    correct_answer: str = Field(min_length=1)
    explanation: str | None = None
    topic_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _build_choices_from_options(self):
        if (
            self.question_type == QuestionType.MULTIPLE_CHOICE
            and self.choices is None
            and self.option_a
            and self.option_b
            and self.option_c
            and self.option_d
        ):
            self.choices = {"A": self.option_a, "B": self.option_b, "C": self.option_c, "D": self.option_d}
        return self


class BulkImportResult(BaseModel):
    created: int
    errors: list[str]