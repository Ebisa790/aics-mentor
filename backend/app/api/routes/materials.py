from datetime import datetime,timezone
import os
import uuid

import json
import logging
from app.core.ai_client import DEFAULT_MODEL, get_groq_client
import docx
import time
from pypdf import PdfReader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from app.models.quiz import Question
from app.core.config import settings
from app.models.exam_question import ExamDifficulty, ExamQuestion, ReviewStatus
from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.course import Course
from app.models.material import LearningMaterial, MaterialSource, MaterialStatus
from app.models.user import SubscriptionTier, User, UserRole
from app.schemas.material import MaterialOut


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["materials"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

def _strip_code_fences(text: str) -> str:
    """Removes markdown code blocks (e.g. ```json ... ```) from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text

def _content_matches_extension(ext: str, first_bytes: bytes) -> bool:
    """
    Checks magic bytes to prevent file extension spoofing.
    """
    if ext == ".pdf":
        return first_bytes.startswith(b"%PDF-")
    if ext == ".docx":
        return first_bytes.startswith(b"PK\x03\x04") or first_bytes.startswith(b"PK\x05\x06")
    if ext == ".txt":
        if b"\x00" in first_bytes:  # Null bytes never appear in valid text files
            return False
        try:
            first_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return False
        return True
    return False


def _validate_and_save(upload: UploadFile) -> tuple[str, str]:
    """
    Validates extension, content signature, and size limits before saving.
    Returns (stored_path, extension).
    """
    original_name = upload.filename or ""
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
        )

    peek = upload.file.read(1024)
    upload.file.seek(0)
    if not _content_matches_extension(ext, peek):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This file's contents don't look like a valid {ext} file — it may be mislabeled or corrupted.",
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(settings.UPLOAD_DIR, stored_name)

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    size = 0
    with open(stored_path, "wb") as out_file:
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                out_file.close()
                if os.path.exists(stored_path):
                    os.remove(stored_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, 
                    detail=f"File exceeds maximum allowed limit of {settings.MAX_UPLOAD_MB}MB"
                )
            out_file.write(chunk)

    return stored_path, ext.lstrip(".")


def _extract_text_from_file(stored_path: str, file_type: str) -> str:
    """Helper to extract raw text content from uploaded files for AI parsing."""
    if file_type == "txt":
        with open(stored_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif file_type == "pdf":
        try:
            reader = PdfReader(stored_path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Failed to parse PDF text: {str(e)}"
            )
    elif file_type == "docx":
        try:
            doc = docx.Document(stored_path)
            return "\n".join([para.text for para in doc.paragraphs])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Failed to parse Word document text: {str(e)}"
            )
    return ""


# ==========================================
# MATERIAL MANAGEMENT ENDPOINTS
# ==========================================

@router.post("/materials", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def upload_material(
    title: str = Form(...),
    course_id: uuid.UUID | None = Form(None),
    topic_id: uuid.UUID | None = Form(None),
    is_public: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stored_path, file_type = _validate_and_save(file)

    source = MaterialSource.ADMIN_OFFICIAL if current_user.role == UserRole.ADMIN else MaterialSource.STUDENT_PERSONAL
    if is_public and current_user.role != UserRole.ADMIN:
        is_public = False

    material = LearningMaterial(
        course_id=course_id,
        topic_id=topic_id,
        uploaded_by_id=current_user.id,
        title=title,
        file_path=stored_path,
        file_type=file_type,
        source=source,
        status=MaterialStatus.UPLOADED,
        is_public=is_public,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/materials", response_model=list[MaterialOut])
def list_materials(
    course_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Students see their own uploads plus public official materials. 
    Admins see all materials across the system.
    Free users see preview status.
    """
    query = db.query(LearningMaterial)
    
    if current_user.role != UserRole.ADMIN:
        query = query.filter(
            (LearningMaterial.uploaded_by_id == current_user.id) | (LearningMaterial.is_public.is_(True))
        )
        
    if course_id:
        query = query.filter(LearningMaterial.course_id == course_id)

    materials = query.order_by(LearningMaterial.created_at.desc()).offset(skip).limit(limit).all()
    
    # Add premium status to response
    is_premium = _is_premium_or_admin(current_user)
    
    result = []
    for material in materials:
        material_dict = MaterialOut.model_validate(material).model_dump()
        material_dict["is_preview"] = not is_premium
        material_dict["preview_percentage"] = 20 if not is_premium else 100
        result.append(material_dict)
    
    return result


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    material = db.get(LearningMaterial, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
        
    if current_user.role != UserRole.ADMIN and material.uploaded_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this material")

    if os.path.exists(material.file_path):
        os.remove(material.file_path)
        
    db.delete(material)
    db.commit()


# ==========================================
# ADMIN HYBRID AI INGESTION ENDPOINTS
# ==========================================

@router.post("/admin/courses/{course_id}/materials/hybrid-generate")
def specific_course_hybrid_generate(
    course_id: uuid.UUID,
    target_count: int = Query(20, ge=5, le=200), # Capped at 200 to prevent sync HTTP timeouts
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Ingests course material, chunks text to respect Groq TPM limits,
    generates questions in batches via Groq, and stages them in the review queue.
    """
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Target course not found")

    client = get_groq_client()
    if client is None:
        raise HTTPException(status_code=503, detail="AI drafting is not configured (missing GROQ_API_KEY)")

    stored_path, file_type = _validate_and_save(file)
    
    try:
        raw_text = _extract_text_from_file(stored_path, file_type)
        if not raw_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="The uploaded file appears to be empty or unreadable."
            )

        # --- SAFE CHUNKING & BATCHING FOR GROQ ---
        # 4000 chars (~700 words) provides enough context for 5-10 solid questions
        CHUNK_SIZE = 4000 
        BATCH_SIZE = 10
        
        text_chunks = [raw_text[i:i+CHUNK_SIZE] for i in range(0, len(raw_text), CHUNK_SIZE)]
        all_generated_items = []

        # System prompt defines context, rules, and required JSON schema
        system_prompt = f"""
You are a senior university professor and curriculum director specializing in the university course '{course.name} ({course.code})'.
Your task is to analyze the provided study material segment and construct high-quality, academically rigorous multiple-choice questions suitable for final university examinations in this specific discipline.

### ADAPTIVE QUESTION GENERATION RULES:
1. **Domain-Aware Question Types:**
   - **For Programming & Algorithms (e.g., Python, C++, Java, PHP, Data Structures):** Generate code-tracing or output questions. Enclose snippets in Markdown fences (e.g., ```cpp, ```java, ```python, ```php). Focus on variable state, loop bounds, recursion, or memory behavior.
   - **For Database Systems (e.g., SQL, DBMS, Schema Design):** Include SQL query output, normalization scenarios, or relational algebra evaluation questions.
   - **For Networking & Security (e.g., TCP/IP, Cryptography, Routing Protocols):** Include network packet/trace scenarios, protocol state analysis, security attack/defense cases, or architectural evaluation questions.
   - **For Systems & Software Engineering (e.g., OS, Web Dev, Design Patterns, Agile):** Include system design scenarios, state transitions, API logic, or architectural principle questions.

2. **Pedagogical Standards:**
   - **Target Higher-Order Thinking:** Avoid basic verbatim definition lookup. Prioritize application, analysis, scenario evaluation, and problem-solving.
   - **High-Quality Distractors:** Distractors MUST be plausible and based on common student misconceptions, subtle logic bugs, or related domain concepts.
   - **Forbidden Options:** NEVER use "All of the above", "None of the above", "Both A and B", or obviously incorrect filler choices.

3. **Rich Explanations:**
   - The `explanation` field must state step-by-step why the correct option is right AND briefly explain why the main distractors are wrong or misleading.

### OUTPUT FORMAT REQUIREMENTS:
- Output ONLY valid, raw JSON with NO surrounding markdown backticks (like ```json).
- The JSON object must contain a single top-level key named `"questions"`.

### REQUIRED JSON SCHEMA:
{{
  "questions": [
    {{
      "question_text": "Detailed question stem or scenario... (embed code/query/trace in markdown fences if applicable)",
      "option_a": "Plausible Option A",
      "option_b": "Plausible Option B",
      "option_c": "Plausible Option C",
      "option_d": "Plausible Option D",
      "correct_option": "A", 
      "explanation": "Detailed explanation of correct answer and distractor breakdown."
    }}
  ]
}}
"""

        for i, chunk in enumerate(text_chunks):
            remaining_needed = target_count - len(all_generated_items)
            if remaining_needed <= 0:
                break

            current_target = min(BATCH_SIZE, remaining_needed)

            user_prompt = f"""
Source Material Segment {i + 1} of {len(text_chunks)}:
---
{chunk}
---

Generate exactly {current_target} multiple-choice questions based on the segment above.
"""

            max_retries = 3
            for attempt in range(max_retries):
                try:
                    completion = client.chat.completions.create(
                        model=DEFAULT_MODEL,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                        max_tokens=2000,
                    )

                    content = completion.choices[0].message.content
                    data = json.loads(_strip_code_fences(content))
                    
                    items = []
                    if isinstance(data, list):
                        items = data
                    elif isinstance(data, dict):
                        items = data.get("questions") or data.get("exam_questions") or data.get("items") or []
                        if not items:
                            for val in data.values():
                                if isinstance(val, list):
                                    items = val
                                    break

                    if items:
                        all_generated_items.extend(items)
                        
                    time.sleep(3.0)  # Pacing for rate limits
                    break

                except Exception as e:
                    err_msg = str(e).lower()
                    if "429" in err_msg or "rate_limit" in err_msg:
                        backoff = (attempt + 1) * 10
                        logger.warning("Rate limit hit on batch %d. Retrying in %d seconds...", i + 1, backoff)
                        time.sleep(backoff)
                    else:
                        logger.error("Error generating batch %d: %s", i + 1, e)
                        break

        # --- DB STAGING ---
        staged_count = 0
        now = datetime.now(timezone.utc)

        for q_data in all_generated_items:
            if not isinstance(q_data, dict):
                continue

            q_text = q_data.get("question_text") or q_data.get("text")
            if not q_text:
                continue

            correct_ans = str(q_data.get("correct_option") or "A").strip().upper()
            if correct_ans not in ["A", "B", "C", "D"]:
                correct_ans = "A"

            db_q = ExamQuestion(
                id=uuid.uuid4(),
                course_id=course_id,
                question_text=q_text,
                option_a=q_data.get("option_a") or "Option A",
                option_b=q_data.get("option_b") or "Option B",
                option_c=q_data.get("option_c") or "Option C",
                option_d=q_data.get("option_d") or "Option D",
                correct_option=correct_ans,
                explanation=q_data.get("explanation") or "Generated from uploaded course material.",
                difficulty=ExamDifficulty.MEDIUM,
                review_status=ReviewStatus.GENERATED,
                is_ai_generated=True,
                ai_model=DEFAULT_MODEL,
                created_at=now,
                updated_at=now
            )
            db.add(db_q)
            staged_count += 1

        db.commit()

        return {
            "message": f"Material for '{course.name}' successfully processed and staged for review.",
            "extracted_count": staged_count,
            "ai_generated_count": staged_count,
            "total_staged": staged_count
        }

    except Exception as e:
        db.rollback()
        logger.error("Specific course hybrid generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and stage questions: {str(e)}"
        )
    finally:
        if os.path.exists(stored_path):
            try:
                os.remove(stored_path)
            except OSError:
                pass
# Add this endpoint at the end of materials.py:

@router.get("/materials/{material_id}/content")
def get_material_content(
    material_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get material content with premium preview for free users.
    - Free users: 20% of extracted text
    - Premium/Admin: Full content
    """
    material = db.get(LearningMaterial, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    # Check access rights
    if material.is_public is False and material.uploaded_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to access this material")
    
    # Check if user is premium
    is_premium = _is_premium_or_admin(current_user)
    
    # Get full content
    full_content = material.extracted_text_preview or ""
    
    # If content is empty, try to extract from file
    if not full_content and os.path.exists(material.file_path):
        try:
            full_content = _extract_text_from_file(material.file_path, material.file_type)
            # Save for future use
            material.extracted_text_preview = full_content[:5000]  # Save first 5000 chars
            db.commit()
        except Exception:
            full_content = ""
    
    # Truncate for free users
    if not is_premium and full_content:
        preview_length = int(len(full_content) * 0.20)
        content = full_content[:preview_length]
        content += "\n\n---\n*🔒 Premium Content - Upgrade to read the full material*"
    else:
        content = full_content
    
    return {
        "id": str(material.id),
        "title": material.title,
        "file_type": material.file_type,
        "content": content,
        "is_preview": not is_premium,
        "preview_percentage": 20 if not is_premium else 100,
        "is_premium_user": is_premium
    }


# Add this helper function if not already in the file:
def _is_premium_or_admin(user: User) -> bool:
    """Check if user has premium access or is admin."""
    if user.role == UserRole.ADMIN:
        return True
    
    if user.subscription_tier == SubscriptionTier.PREMIUM:
        # Check expiration if applicable
        if getattr(user, "subscription_expires_at", None):
            now = datetime.now(timezone.utc)
            expires = user.subscription_expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            return expires > now
        return True
    
    return False
