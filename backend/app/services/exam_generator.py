import logging
import random
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.quiz import DifficultyLevel, Question
from app.models.course import Course

logger = logging.getLogger(__name__)


def get_student_seen_question_ids(db: Session, student_id: uuid.UUID, course_id: uuid.UUID | None = None) -> set:
    """
    Get all question IDs a student has already seen in previous attempts.
    Uses existing AttemptAnswer data - no new table needed.
    """
    from app.models.attempt import Attempt, AttemptAnswer

    query = (
        db.query(AttemptAnswer.question_id)
        .join(Attempt, Attempt.id == AttemptAnswer.attempt_id)
        .filter(Attempt.student_id == student_id)
    )

    if course_id:
        query = query.join(Question, Question.id == AttemptAnswer.question_id)
        query = query.filter(Question.course_id == course_id)

    seen_ids = {row[0] for row in query.all()}
    return seen_ids


DIFFICULTY_SPLIT: dict[DifficultyLevel, float] = {
    DifficultyLevel.BEGINNER: 0.2,
    DifficultyLevel.INTERMEDIATE: 0.6,
    DifficultyLevel.ADVANCED: 0.2,
}

# Official MoE Computer Science Exit Exam Blueprint Quotas (Table 6-1)
OFFICIAL_BLUEPRINT_QUOTAS: dict[str, int] = {
    "software engineering": 6,
    "web programming": 9,
    "fundamentals of database systems": 6,
    "advanced database systems": 6,
    "computer programming": 6,
    "object oriented programming": 6,
    "design and analysis of algorithms": 6,
    "data structures and algorithms": 7,
    "data communication and computer networking": 6,
    "computer security": 6,
    "network and system administration": 6,
    "introduction to artificial intelligence": 6,
    "operating systems": 6,
    "computer organization and architecture": 6,
    "automata and complexity theory": 6,
    "compiler design": 6,
}


def _target_counts(total: int) -> dict[DifficultyLevel, int]:
    beginner = round(total * DIFFICULTY_SPLIT[DifficultyLevel.BEGINNER])
    advanced = round(total * DIFFICULTY_SPLIT[DifficultyLevel.ADVANCED])
    intermediate = total - beginner - advanced
    return {
        DifficultyLevel.BEGINNER: beginner,
        DifficultyLevel.INTERMEDIATE: intermediate,
        DifficultyLevel.ADVANCED: advanced,
    }


def sample_questions_for_course(db: Session, course_id: uuid.UUID, total: int = 10, student_id: uuid.UUID | None = None) -> list[Question]:
    """
    Samples `total` questions for a course, preferring unseen questions for the student.
    - If enough unseen questions exist, uses only unseen (no repetition across attempts).
    - If not enough unseen, fills remaining from seen questions.
    """
    all_course_questions = db.query(Question).filter(Question.course_id == course_id).all()
    
    if not all_course_questions:
        raise HTTPException(
            status_code=422,
            detail="This course has no questions seeded in the database yet. Please add questions via the admin panel."
        )
    
    # Get seen question IDs for this student
    seen_ids = set()
    if student_id:
        seen_ids = get_student_seen_question_ids(db, student_id, course_id)
    
    # Separate unseen and seen questions
    unseen_questions = [q for q in all_course_questions if q.id not in seen_ids]
    seen_questions = [q for q in all_course_questions if q.id in seen_ids]
    
    # Prefer unseen questions
    if len(unseen_questions) >= total:
        # We have enough unseen questions - use only these
        selected = random.sample(unseen_questions, total)
    else:
        # Use all unseen + fill from seen
        selected = list(unseen_questions)
        remaining_needed = total - len(selected)
        if seen_questions and remaining_needed > 0:
            selected.extend(random.sample(seen_questions, min(remaining_needed, len(seen_questions))))
    
    random.shuffle(selected)
    return selected[:total]


def sample_questions_for_official_mock(db: Session, total_count: int = 100, student_id: uuid.UUID | None = None) -> list[Question]:
    """
    Samples questions across courses proportionally following the official 
    MoE Computer Science Exit Exam Blueprint quotas based on the requested total_count, 
    with automatic fallback padding to guarantee the exact requested count.
    Prefers unseen questions for the student.
    """
    courses = db.query(Course).all()
    if not courses:
        raise HTTPException(status_code=404, detail="No courses found in the database.")

    all_sampled_questions = []
    
    # Compute dynamic sum of active blueprint quotas for accurate ratio scaling
    total_blueprint_sum = sum(OFFICIAL_BLUEPRINT_QUOTAS.values())

    # First pass: proportional blueprint sampling
    for course in courses:
        c_name_lower = course.name.lower().strip()
        base_quota = 6  # default fallback quota for unlisted courses
        
        for key, quota in OFFICIAL_BLUEPRINT_QUOTAS.items():
            if key in c_name_lower:
                base_quota = quota
                break

        scaled_target = max(1, round(base_quota * (total_count / total_blueprint_sum)))
        course_questions = db.query(Question).filter(Question.course_id == course.id).all()
        
        if not course_questions:
            continue  

        # Get seen IDs for this student
        seen_ids = set()
        if student_id:
            seen_ids = get_student_seen_question_ids(db, student_id, course.id)
        
        # Separate unseen and seen questions for this course
        unseen_course_questions = [q for q in course_questions if q.id not in seen_ids]
        seen_course_questions = [q for q in course_questions if q.id in seen_ids]
        
        sampled_count = min(len(course_questions), scaled_target)
        
        # Prefer unseen questions
        if len(unseen_course_questions) >= sampled_count:
            selected = random.sample(unseen_course_questions, sampled_count)
        else:
            selected = list(unseen_course_questions)
            remaining = sampled_count - len(selected)
            if seen_course_questions and remaining > 0:
                selected.extend(random.sample(seen_course_questions, min(remaining, len(seen_course_questions))))
        
        all_sampled_questions.extend(selected)

    # If we collected too many, trim down to total_count
    if len(all_sampled_questions) > total_count:
        # Prefer keeping unseen questions when trimming
        if student_id:
            all_seen_ids = get_student_seen_question_ids(db, student_id)
            unseen_in_sampled = [q for q in all_sampled_questions if q.id not in all_seen_ids]
            seen_in_sampled = [q for q in all_sampled_questions if q.id in all_seen_ids]
            
            # Keep as many unseen as possible
            if len(unseen_in_sampled) >= total_count:
                all_sampled_questions = random.sample(unseen_in_sampled, total_count)
            else:
                selected = list(unseen_in_sampled)
                remaining = total_count - len(selected)
                if seen_in_sampled:
                    selected.extend(random.sample(seen_in_sampled, min(remaining, len(seen_in_sampled))))
                all_sampled_questions = selected
        else:
            all_sampled_questions = random.sample(all_sampled_questions, total_count)

    # If we collected fewer than requested, pad with remaining questions from any course
    if len(all_sampled_questions) < total_count:
        existing_ids = {q.id for q in all_sampled_questions}
        
        # Get all questions not already selected
        all_db_questions = db.query(Question).all()
        remaining_pool = [q for q in all_db_questions if q.id not in existing_ids]
        
        # Prefer unseen questions when padding
        if student_id:
            all_seen_ids = get_student_seen_question_ids(db, student_id)
            unseen_pool = [q for q in remaining_pool if q.id not in all_seen_ids]
            seen_pool = [q for q in remaining_pool if q.id in all_seen_ids]
            
            needed_more = total_count - len(all_sampled_questions)
            
            # First fill from unseen
            if unseen_pool:
                take_unseen = min(needed_more, len(unseen_pool))
                all_sampled_questions.extend(random.sample(unseen_pool, take_unseen))
                needed_more -= take_unseen
            
            # Then fill from seen if still needed
            if needed_more > 0 and seen_pool:
                all_sampled_questions.extend(random.sample(seen_pool, min(needed_more, len(seen_pool))))
        else:
            needed_more = total_count - len(all_sampled_questions)
            if remaining_pool:
                all_sampled_questions.extend(random.sample(remaining_pool, min(needed_more, len(remaining_pool))))

    if not all_sampled_questions:
        raise HTTPException(
            status_code=422,
            detail="No course question banks are sufficiently populated yet to generate a mock exam."
        )

    random.shuffle(all_sampled_questions)
    return all_sampled_questions