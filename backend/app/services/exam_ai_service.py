import json
import logging
import uuid
from sqlalchemy.orm import Session

from app.core.ai_client import get_groq_client, DEFAULT_MODEL
from app.models.exam_question import ExamQuestion, ExamDifficulty, ReviewStatus
from app.models.user import User

logger = logging.getLogger(__name__)


def generate_exam_questions_via_groq(
    db: Session,
    course_id: uuid.UUID,
    topic: str,
    num_questions: int,
    difficulty: ExamDifficulty,
    admin_user: User
) -> list[ExamQuestion]:
    client = get_groq_client()
    if not client:
        raise RuntimeError("Groq API key is not configured in environment settings.")

    prompt = f"""
    You are an expert Computer Science professor for Ethiopian universities creating national exit exam questions.
    Generate exactly {num_questions} multiple-choice questions for the topic: "{topic}" at difficulty level "{difficulty.value}".
    
    You MUST return a valid JSON object with a single key "questions" containing an array of objects.
    Each object must have:
    - "question_text": The clear question string.
    - "option_a": Choice A text.
    - "option_b": Choice B text.
    - "option_c": Choice C text.
    - "option_d": Choice D text.
    - "correct_option": Exactly one of "A", "B", "C", or "D".
    - "explanation": Comprehensive technical explanation of the correct answer.
    """

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": "You are a precise technical assessment generator. Output strictly valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        content = response.choices[0].message.content
        data = json.loads(content)
        raw_items = data.get("questions", [])

        if not isinstance(raw_items, list):
            raise ValueError("LLM response 'questions' key did not contain a valid list.")

        created_questions = []
        for item in raw_items:
            question_text = item.get("question_text")
            option_a = item.get("option_a")
            option_b = item.get("option_b")
            option_c = item.get("option_c")
            option_d = item.get("option_d")
            correct_option = item.get("correct_option")
            explanation = item.get("explanation")

            # Validate that all required fields are present for this item
            if not all([question_text, option_a, option_b, option_c, option_d, correct_option, explanation]):
                logger.warning("Skipping malformed question item returned by AI: %s", item)
                continue

            exam_q = ExamQuestion(
                course_id=course_id,
                created_by_id=admin_user.id,
                question_text=question_text,
                option_a=option_a,
                option_b=option_b,
                option_c=option_c,
                option_d=option_d,
                correct_option=str(correct_option).upper().strip(),
                explanation=explanation,
                difficulty=difficulty,
                is_ai_generated=True,
                review_status=ReviewStatus.GENERATED,  # Staged for review
                ai_model=DEFAULT_MODEL,
                ai_topic=topic
            )
            db.add(exam_q)
            created_questions.append(exam_q)
        
        if not created_questions:
            raise ValueError("No valid questions were successfully parsed from the AI response.")

        db.commit()
        for q in created_questions:
            db.refresh(q)
            
        return created_questions

    except Exception as e:
        db.rollback()
        logger.error("Groq generation failed for topic '%s': %s", topic, str(e))
        raise RuntimeError(f"Groq generation failed: {str(e)}")