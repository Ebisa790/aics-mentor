import os
import uuid
import json
import logging
import time
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.ai_client import DEFAULT_MODEL, get_groq_client
from app.models.course import Course
from app.models.exam_question import ExamQuestion, ExamDifficulty, ReviewStatus

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.tasks.master_takes.process_master_booklet_task",
    max_retries=3,
    default_retry_delay=15,
)
def process_master_booklet_task(
    self,
    file_path: str,
    filename: str,
    target_count: int,
    admin_user_id: str,
    single_course_id: str = None,
) -> dict:
    """
    Background Celery task to process master booklets or single-course study materials,
    extract text, run AI mapping/generation in batches, and stage ExamQuestions for review.
    """
    from app.api.routes.admin import (
        _extract_text_universal,
        MASTER_HYBRID_PROMPT,
        _strip_code_fences,
    )

    self.update_state(state="PROGRESS", meta={"step": "Parsing file text..."})

    if not os.path.exists(file_path):
        return {"status": "failed", "error": "Uploaded temp file not found on disk."}

    try:
        raw_text = _extract_text_universal(file_path, filename)
    except Exception as e:
        logger.error("Text extraction failed for %s: %s", filename, e)
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"status": "failed", "error": f"Failed to extract text: {str(e)}"}

    if not raw_text.strip():
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"status": "failed", "error": "Extracted text was empty."}

    self.update_state(
        state="PROGRESS", meta={"step": "Initializing AI model and Database..."}
    )
    client = get_groq_client()
    if not client:
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"status": "failed", "error": "Groq client configuration missing."}

    db = SessionLocal()
    try:
        # 1. Handle Single-Course vs Multi-Course Scope
        if single_course_id:
            target_course = (
                db.query(Course).filter(Course.id == single_course_id).first()
            )
            if not target_course:
                return {
                    "status": "failed",
                    "error": "Target course not found in database.",
                }
            courses = [target_course]
        else:
            courses = db.query(Course).all()
            if not courses:
                return {
                    "status": "failed",
                    "error": "No courses found in database.",
                }

        courses_list_str = "\n".join(
            [
                f"- Code: {c.code or 'N/A'}, Name: {c.name or c.title} (ID: {c.id})"
                for c in courses
            ]
        )

        # Normalized lookup maps
        code_to_course = {c.code.strip().upper(): c for c in courses if c.code}
        name_to_course = {
            (c.name or c.title).strip().upper(): c
            for c in courses
            if (c.name or c.title)
        }

        # --- OPTIMIZED FOR GROQ FREE TIER LIMITS ---
        CHUNK_SIZE = 7000
        BATCH_SIZE = 10

        text_chunks = [
            raw_text[i : i + CHUNK_SIZE]
            for i in range(0, len(raw_text), CHUNK_SIZE)
        ]
        all_generated_items = []

        for i, chunk in enumerate(text_chunks):
            remaining_needed = target_count - len(all_generated_items)
            if remaining_needed <= 0:
                break

            current_target = min(BATCH_SIZE, remaining_needed)

            self.update_state(
                state="PROGRESS",
                meta={
                    "step": f"Calling AI: Batch {i+1}/{len(text_chunks)} (Seeking {current_target} questions)..."
                },
            )

            formatted_prompt = MASTER_HYBRID_PROMPT.format(
                target_count=current_target,
                courses_list_str=courses_list_str,
            )

            max_retries = 3
            for attempt in range(max_retries):
                try:
                    completion = client.chat.completions.create(
                        model=DEFAULT_MODEL,
                        messages=[
                            {"role": "system", "content": formatted_prompt},
                            {
                                "role": "user",
                                "content": f"Source Document Text (Part {i+1}):\n\n{chunk}",
                            },
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                        max_tokens=2000,
                    )

                    content = completion.choices[0].message.content
                    data = json.loads(_strip_code_fences(content))

                    # --- BULLETPROOF JSON KEY AUTO-DETECTION ---
                    items = []
                    if isinstance(data, list):
                        items = data
                    elif isinstance(data, dict):
                        for key in [
                            "questions",
                            "exam_questions",
                            "items",
                            "data",
                            "results",
                        ]:
                            if key in data and isinstance(data[key], list):
                                items = data[key]
                                break
                        if not items:
                            for val in data.values():
                                if isinstance(val, list):
                                    items = val
                                    break
                    # -------------------------------------------

                    if items:
                        all_generated_items.extend(items)

                    time.sleep(3.5)
                    break

                except Exception as e:
                    err_msg = str(e).lower()
                    if (
                        "429" in err_msg
                        or "413" in err_msg
                        or "rate_limit" in err_msg
                    ):
                        backoff = (attempt + 1) * 15
                        logger.warning(
                            "Rate/Token limit hit on batch %d. Sleeping %d seconds...",
                            i + 1,
                            backoff,
                        )
                        time.sleep(backoff)
                    else:
                        logger.error(
                            "Error generating batch %d: %s", i + 1, e
                        )
                        break

        # --- DATABASE STAGING LOGIC ---
        self.update_state(
            state="PROGRESS",
            meta={
                "step": f"Saving {len(all_generated_items)} total items to review queue..."
            },
        )

        detected_courses = set()
        total_staged = 0
        admin_uuid = uuid.UUID(admin_user_id)
        now_utc = datetime.now(timezone.utc)

        for item in all_generated_items:
            if not isinstance(item, dict):
                continue

            question_text = (
                item.get("question_text")
                or item.get("text")
                or item.get("prompt")
            )
            if not question_text:
                continue

            # If single_course_id is provided, force bind directly to it
            if single_course_id:
                target_course = courses[0]
            else:
                raw_identifier = (
                    item.get("course_code") or item.get("course_name") or ""
                ).strip().upper()
                target_course = None

                # 1. Exact Code Match
                if raw_identifier in code_to_course:
                    target_course = code_to_course[raw_identifier]
                # 2. Exact Name Match
                elif raw_identifier in name_to_course:
                    target_course = name_to_course[raw_identifier]
                # 3. Substring Match
                elif raw_identifier:
                    for c_code, c_obj in code_to_course.items():
                        if (
                            c_code in raw_identifier
                            or raw_identifier in c_code
                        ):
                            target_course = c_obj
                            break
                    if not target_course:
                        for c_name, c_obj in name_to_course.items():
                            if (
                                c_name in raw_identifier
                                or raw_identifier in c_name
                            ):
                                target_course = c_obj
                                break

                # 4. Fallback to first course if unmapped
                if not target_course and courses:
                    target_course = courses[0]

            if not target_course:
                continue

            correct_opt = (
                item.get("correct_option")
                or item.get("correct_answer")
                or "A"
            ).strip().upper()
            if correct_opt not in ["A", "B", "C", "D"]:
                correct_opt = "A"

            # Stage as ExamQuestion for the Review Queue
            exam_q = ExamQuestion(
                course_id=target_course.id,
                created_by_id=admin_uuid,
                question_text=question_text,
                option_a=item.get("option_a") or item.get("a") or "Option A",
                option_b=item.get("option_b") or item.get("b") or "Option B",
                option_c=item.get("option_c") or item.get("c") or "Option C",
                option_d=item.get("option_d") or item.get("d") or "Option D",
                correct_option=correct_opt,
                explanation=item.get("explanation"),
                difficulty=ExamDifficulty.MEDIUM,
                review_status=ReviewStatus.GENERATED,
                is_ai_generated=True,
                ai_model=DEFAULT_MODEL,
                created_at=now_utc,
                updated_at=now_utc,
            )
            db.add(exam_q)
            detected_courses.add(str(target_course.id))
            total_staged += 1

        db.commit()
        return {
            "status": "success",
            "message": "Material successfully processed and staged for review.",
            "courses_detected_count": len(detected_courses),
            "total_staged": total_staged,
        }

    except Exception as exc:
        db.rollback()
        logger.error(
            "Celery task error in process_master_booklet_task: %s",
            exc,
            exc_info=True,
        )
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as cleanup_err:
                logger.warning(
                    "Failed to remove temp file %s: %s", file_path, cleanup_err
                )