"""
Question Management Routes
Handles question coverage reporting, export prompts, and bulk operations.
Separated from admin.py for better organization.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.course import Course
from app.models.quiz import Question
from app.models.course_material import CourseMaterial
from app.models.exam_question import ExamQuestion, ReviewStatus
from app.api.deps import require_admin

router = APIRouter(prefix="/api/admin/questions", tags=["admin-questions"])


# ============================== Question Coverage Report ==============================

@router.get("/coverage")
def get_question_coverage(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Returns question bank coverage report."""
    
    # Course breakdown
    course_stats = db.query(
        Course.name,
        Course.code,
        Course.id,
        func.count(Question.id).label('question_count')
    ).outerjoin(Question, Course.id == Question.course_id)\
     .group_by(Course.id, Course.name, Course.code)\
     .order_by(func.count(Question.id))\
     .all()
    
    courses = []
    for c in course_stats:
        target = 100
        count = c.question_count or 0
        
        if count < 20:
            status = 'CRITICAL'
        elif count < 80:
            status = 'WARNING'
        elif count < 100:
            status = 'NEAR_TARGET'
        else:
            status = 'GOOD'
        
        courses.append({
            "id": str(c.id),
            "name": c.name,
            "code": c.code,
            "question_count": count,
            "target": target,
            "gap": max(0, target - count),
            "status": status
        })
    
    # Difficulty breakdown
    easy_count = db.query(Question).filter(Question.difficulty == 'beginner').count()
    medium_count = db.query(Question).filter(Question.difficulty == 'intermediate').count()
    hard_count = db.query(Question).filter(Question.difficulty == 'advanced').count()
    
    total = easy_count + medium_count + hard_count
    
    target_easy = int(total * 0.30)
    target_medium = int(total * 0.50)
    target_hard = int(total * 0.20)
    
    difficulty = {
        "easy": {
            "count": easy_count,
            "target": target_easy,
            "gap": max(0, target_easy - easy_count),
            "percentage": round((easy_count / total) * 100, 1) if total > 0 else 0
        },
        "medium": {
            "count": medium_count,
            "target": target_medium,
            "gap": max(0, target_medium - medium_count),
            "percentage": round((medium_count / total) * 100, 1) if total > 0 else 0
        },
        "hard": {
            "count": hard_count,
            "target": target_hard,
            "gap": max(0, target_hard - hard_count),
            "percentage": round((hard_count / total) * 100, 1) if total > 0 else 0
        }
    }
    
    return {
        "total_questions": total,
        "courses": courses,
        "difficulty": difficulty,
        "critical_courses": [c for c in courses if c['status'] == 'CRITICAL'],
        "warning_courses": [c for c in courses if c['status'] == 'WARNING']
    }


# ============================== Question Export Prompts ==============================

@router.post("/export-prompt")
def export_question_prompt(
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Export course-specific, difficulty-specific prompt for ChatGPT."""
    
    course_id = payload.get("course_id")
    difficulty = payload.get("difficulty", "medium")
    count = payload.get("count", 20)
    
    course = db.get(Course, uuid.UUID(course_id)) if course_id else None
    
    if not course:
        raise HTTPException(404, "Course not found")
    
    # Get uploaded materials
    materials = db.query(CourseMaterial).filter(
        CourseMaterial.course_id == course.id
    ).all()
    
    if materials:
        extracted = [m.content[:3000] for m in materials if m.content]
        material_text = "\n\n--- MATERIAL ---\n\n".join(extracted[:2])
        source_instruction = f"""USE THE FOLLOWING UPLOADED MATERIAL AS PRIMARY SOURCE:
{material_text}

Base ALL questions on the concepts found in this material."""
    else:
        source_instruction = f"""NO UPLOADED MATERIAL FOUND.
Base questions on STANDARD Ethiopian CS Exit Exam patterns for {course.name} ({course.code}).
Use real past exam questions as reference."""
    
    # Course-specific focus areas
    course_focus = {
        "Computer Programming": "Increment/decrement, loops, arrays, pointers, functions, recursion",
        "Object Oriented Programming": "Constructors, inheritance, polymorphism, method overriding",
        "Data Structures and Algorithms": "Stack, queue, tree traversal, sorting, searching",
        "Operating System": "Process scheduling, memory management, deadlock, page replacement",
        "Database Systems": "Normalization, SQL queries, ER diagrams, transactions",
        "Networking": "OSI model, subnetting, protocols, routing",
        "Compiler Design": "Lexical analysis, parsing, semantic analysis, code generation",
        "Automata Theory": "DFA/NFA, regular expressions, CFG, Turing machines",
        "Software Engineering": "SDLC models, requirements, testing, UML",
        "AI": "Search algorithms, knowledge representation, ML basics",
    }
    
    focus = course_focus.get(course.name, course.category)
    
    difficulty_instructions = {
        "easy": "Basic definitions, direct recall, simple one-step answers, short code output (2-4 lines)",
        "medium": "Application of concepts, 2-3 step problems, code output (5-8 lines), compare and contrast",
        "hard": "Complex problem solving, multi-step reasoning, code output (10-15 lines), tricky edge cases"
    }
    
    prompt = f"""You are an Ethiopian CS Exit Exam question setter for {course.name} ({course.code}).

Generate {count} {difficulty.upper()} questions.

DIFFICULTY LEVEL: {difficulty_instructions[difficulty]}

{source_instruction}

COURSE FOCUS: {focus}

EACH QUESTION MUST HAVE:
- question_text: The question prompt
- option_a, option_b, option_c, option_d: Four choices
- correct_option: "A", "B", "C", or "D"
- explanation: Why correct answer is right
- difficulty: "{difficulty}"

FORMAT: Return ONLY a JSON array of {count} questions."""
    
    return {"prompt": prompt, "course": course.name, "difficulty": difficulty}


# ============================== Bulk Question Import ==============================

@router.post("/bulk-import")
def bulk_import_questions(
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Import questions from ChatGPT -> Sends to EXAM_QUESTIONS review queue."""
    from datetime import datetime
    
    questions_data = payload.get("questions", [])
    course_id = payload.get("course_id")
    
    if not questions_data:
        raise HTTPException(400, "No questions provided")
    
    if not course_id:
        raise HTTPException(400, "course_id required")
    
    course = db.get(Course, uuid.UUID(course_id))
    if not course:
        raise HTTPException(404, "Course not found")
    
    # Map difficulty to exam_difficulty enum values
    # The exam_questions table uses: EASY, MEDIUM, HARD
    diff_map = {
        "easy": "EASY",
        "medium": "MEDIUM", 
        "hard": "HARD",
        "EASY": "EASY",
        "MEDIUM": "MEDIUM",
        "HARD": "HARD",
        "beginner": "easy",
        "intermediate": "medium",
        "advanced": "hard"
    }
    
    created = 0
    for q in questions_data:
        diff_value = q.get("difficulty", "medium")
        mapped_diff = diff_map.get(diff_value.lower(), "intermediate")
        
        # Create exam question with GENERATED status (needs review)
        exam_question = ExamQuestion(
            course_id=course.id,
            question_text=q.get("question_text", ""),
            option_a=q.get("option_a", ""),
            option_b=q.get("option_b", ""),
            option_c=q.get("option_c", ""),
            option_d=q.get("option_d", ""),
            correct_option=q.get("correct_option", "A"),
            explanation=q.get("explanation", ""),
            difficulty=mapped_diff,
            review_status=ReviewStatus.GENERATED,  # Needs admin review
            is_ai_generated=True,
            created_by_id=admin_user.id,
            created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
        )
        db.add(exam_question)
        created += 1
    
    db.commit()
    
    return {
        "message": f"Added {created} questions to review queue for {course.name}",
        "created": created,
        "course": course.name,
        "queue_url": "/admin/review-queue"
    }
    
    questions_data = payload.get("questions", [])
    course_id = payload.get("course_id")
    
    if not questions_data:
        raise HTTPException(400, "No questions provided")
    
    if not course_id:
        raise HTTPException(400, "course_id required")
    
    course = db.get(Course, uuid.UUID(course_id))
    if not course:
        raise HTTPException(404, "Course not found")
    
    created = 0
    for q in questions_data:
        # Map difficulty to enum values
        diff_map = {
            "easy": "beginner",
            "medium": "intermediate", 
            "hard": "advanced",
            "easy": "beginner",
            "MEDIUM": "intermediate",
            "HARD": "advanced"
        }
        diff_value = q.get("difficulty", "medium")
        mapped_diff = diff_map.get(diff_value.lower(), "intermediate")
        
        from datetime import datetime
        new_question = Question(
            course_id=course.id,
            prompt=q.get("question_text", ""),
            question_type="multiple_choice",
            difficulty=mapped_diff,
            created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            choices={
                "A": q.get("option_a", ""),
                "B": q.get("option_b", ""),
                "C": q.get("option_c", ""),
                "D": q.get("option_d", "")
            },
            correct_answer=q.get("correct_option", "A"),
            explanation=q.get("explanation", "")
        )
        db.add(new_question)
        created += 1
    
    db.commit()
    
    return {
        "message": f"Imported {created} questions",
        "created": created
    }


# ============================== Question Stats by Course ==============================

@router.get("/course/{course_id}/stats")
def get_course_question_stats(
    course_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Get detailed question stats for a specific course."""
    
    course = db.get(Course, uuid.UUID(course_id))
    if not course:
        raise HTTPException(404, "Course not found")
    
    total = db.query(Question).filter(Question.course_id == course.id).count()
    easy = db.query(Question).filter(Question.course_id == course.id, Question.difficulty == 'beginner').count()
    medium = db.query(Question).filter(Question.course_id == course.id, Question.difficulty == 'intermediate').count()
    hard = db.query(Question).filter(Question.course_id == course.id, Question.difficulty == 'advanced').count()
    
    return {
        "course": course.name,
        "total": total,
        "easy": easy,
        "medium": medium,
        "hard": hard,
        "target": 100,
        "gap": max(0, 100 - total)
    }
