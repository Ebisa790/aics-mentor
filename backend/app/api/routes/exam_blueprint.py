"""Exam Blueprint API — returns the official MoE Exit Exam structure."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.exam_blueprint import ExamBlueprintItem
from app.schemas.exam_blueprint import (
    ExamBlueprintResponse,
    ExamBlueprintItemOut,
    BlueprintSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exam-blueprint", tags=["exam-blueprint"])


@router.get("", response_model=ExamBlueprintResponse)
def get_exam_blueprint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the official MoE Exit Exam blueprint."""
    items = (
        db.query(ExamBlueprintItem)
        .order_by(ExamBlueprintItem.display_order)
        .all()
    )

    # Compute totals
    total_items = sum(i.test_items for i in items)
    themes = {i.theme for i in items}
    total_courses = len(items)

    cognitive_totals = {
        "remember": sum(i.cognitive_remember for i in items),
        "understand": sum(i.cognitive_understand for i in items),
        "apply": sum(i.cognitive_apply for i in items),
        "analyze": sum(i.cognitive_analyze for i in items),
        "evaluate": sum(i.cognitive_evaluate for i in items),
        "create": sum(i.cognitive_create for i in items),
    }

    return ExamBlueprintResponse(
        summary=BlueprintSummary(
            total_items=total_items,
            total_courses=total_courses,
            total_themes=len(themes),
            cognitive_totals=cognitive_totals,
        ),
        items=[ExamBlueprintItemOut.model_validate(i) for i in items],
    )