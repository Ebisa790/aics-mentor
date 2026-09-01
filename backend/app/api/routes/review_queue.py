"""
Review Queue Routes
Handles admin review of AI-generated questions using ExamQuestion model.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.course import Course
from app.models.quiz import Question
from app.models.exam_question import ExamQuestion, ReviewStatus
from app.api.deps import require_admin

router = APIRouter(prefix="/api/admin/review-queue", tags=["admin-review"])


@router.get("/")
def get_review_queue(
    status: str = Query(None, description="Filter by status: generated, under_review, approved, rejected"),
    course_id: str = Query(None, description="Filter by course"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Get all review queue items from ExamQuestion table."""
    
    query = db.query(ExamQuestion)
    
    if status:
        query = query.filter(ExamQuestion.review_status == status)
    if course_id:
        query = query.filter(ExamQuestion.course_id == uuid.UUID(course_id))
    
    # Show generated and under_review first
    query = query.order_by(
        ExamQuestion.review_status.desc(),  # PENDING first
        ExamQuestion.created_at.desc()
    )
    
    items = query.all()
    
    # Join with course data
    result = []
    for item in items:
        course = db.get(Course, item.course_id)
        result.append({
            "id": str(item.id),
            "course_id": str(item.course_id),
            "course_name": course.name if course else "Unknown",
            "course_code": course.code if course else "",
            "question_text": item.question_text,
            "option_a": item.option_a,
            "option_b": item.option_b,
            "option_c": item.option_c,
            "option_d": item.option_d,
            "correct_option": item.correct_option,
            "explanation": item.explanation,
            "difficulty": item.difficulty,
            "review_status": item.review_status,
            "is_ai_generated": item.is_ai_generated,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "created_by_id": str(item.created_by_id) if item.created_by_id else None,
            "reviewed_by_id": str(item.reviewed_by_id) if item.reviewed_by_id else None,
            "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
        })
    
    return {
        "total": len(result),
        "items": result
    }


@router.get("/count")
def get_review_queue_counts(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Get counts by status for review queue dashboard."""
    
    generated = db.query(ExamQuestion).filter(ExamQuestion.review_status == ReviewStatus.GENERATED).count()
    under_review = db.query(ExamQuestion).filter(ExamQuestion.review_status == ReviewStatus.UNDER_REVIEW).count()
    approved = db.query(ExamQuestion).filter(ExamQuestion.review_status == ReviewStatus.APPROVED).count()
    rejected = db.query(ExamQuestion).filter(ExamQuestion.review_status == ReviewStatus.REJECTED).count()
    
    return {
        "generated": generated,
        "under_review": under_review,
        "approved": approved,
        "rejected": rejected,
        "pending": generated + under_review,
        "total": generated + under_review + approved + rejected
    }


@router.put("/{item_id}/approve")
def approve_review_item(
    item_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Approve a review queue item and move to Questions table."""
    
    item = db.get(ExamQuestion, uuid.UUID(item_id))
    if not item:
        raise HTTPException(404, "Review item not found")
    
    if item.review_status not in [ReviewStatus.GENERATED, ReviewStatus.UNDER_REVIEW]:
        raise HTTPException(400, "Item already reviewed or not in review queue")
    
    # Create the actual question in Questions table
    new_question = Question(
        course_id=item.course_id,
        prompt=item.question_text,
        question_type="multiple_choice",
        difficulty=item.difficulty,
        choices={
            "A": item.option_a,
            "B": item.option_b,
            "C": item.option_c,
            "D": item.option_d
        },
        correct_answer=item.correct_option,
        explanation=item.explanation,
        is_ai_generated=item.is_ai_generated,
        created_at=datetime.utcnow()
    )
    db.add(new_question)
    
    # Update exam question status
    item.review_status = ReviewStatus.APPROVED
    item.reviewed_by_id = admin_user.id
    item.reviewed_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Question approved and added to database",
        "question_id": str(new_question.id)
    }


@router.put("/{item_id}/reject")
def reject_review_item(
    item_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Reject a review queue item."""
    
    item = db.get(ExamQuestion, uuid.UUID(item_id))
    if not item:
        raise HTTPException(404, "Review item not found")
    
    if item.review_status not in [ReviewStatus.GENERATED, ReviewStatus.UNDER_REVIEW]:
        raise HTTPException(400, "Item already reviewed")
    
    item.review_status = ReviewStatus.REJECTED
    item.reviewed_by_id = admin_user.id
    item.reviewed_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Question rejected"}


@router.put("/{item_id}/edit")
def edit_review_item(
    item_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Edit a review queue item before approval."""
    
    item = db.get(ExamQuestion, uuid.UUID(item_id))
    if not item:
        raise HTTPException(404, "Review item not found")
    
    # Update fields
    if "question_text" in payload:
        item.question_text = payload["question_text"]
    if "option_a" in payload:
        item.option_a = payload["option_a"]
    if "option_b" in payload:
        item.option_b = payload["option_b"]
    if "option_c" in payload:
        item.option_c = payload["option_c"]
    if "option_d" in payload:
        item.option_d = payload["option_d"]
    if "correct_option" in payload:
        item.correct_option = payload["correct_option"]
    if "explanation" in payload:
        item.explanation = payload["explanation"]
    if "difficulty" in payload:
        item.difficulty = payload["difficulty"]
    
    item.review_status = ReviewStatus.UNDER_REVIEW
    item.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Review item updated"}


@router.post("/bulk-approve")
def bulk_approve(
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Approve multiple review items at once."""
    
    item_ids = payload.get("item_ids", [])
    
    if not item_ids:
        raise HTTPException(400, "No item IDs provided")
    
    approved = 0
    for item_id in item_ids:
        item = db.get(ExamQuestion, uuid.UUID(item_id))
        if item and item.review_status in [ReviewStatus.GENERATED, ReviewStatus.UNDER_REVIEW]:
            # Create question
            new_question = Question(
                course_id=item.course_id,
                prompt=item.question_text,
                question_type="multiple_choice",
                difficulty=item.difficulty,
                choices={
                    "A": item.option_a,
                    "B": item.option_b,
                    "C": item.option_c,
                    "D": item.option_d
                },
                correct_answer=item.correct_option,
                explanation=item.explanation,
                is_ai_generated=item.is_ai_generated,
                created_at=datetime.utcnow()
            )
            db.add(new_question)
            
            item.review_status = ReviewStatus.APPROVED
            item.reviewed_by_id = admin_user.id
            item.reviewed_at = datetime.utcnow()
            approved += 1
    
    db.commit()
    
    return {
        "message": f"Approved {approved} questions",
        "approved_count": approved
    }
