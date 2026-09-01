import os
import json
import random
import time
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer
from groq import Groq
from pydantic import BaseModel

from app.services.cpp_compiler import execute_cpp_code
from app.services.trace_verifier import verify_and_patch_drill
from app.core.database import get_db
from app.models.user import User
from app.models.attempt import DrillAttempt
from app.schemas.code_trace import (
    CodeTraceRequest,
    CodeTraceResponse,
    DrillSubmitRequest,
    DrillSubmitResponse
)
from app.api.deps import get_current_user 

router = APIRouter(prefix="/drills", tags=["drills"])

class CppVerificationRequest(BaseModel):
    code_snippet: str
    timeout_seconds: Optional[float] = 2.0

class TraceVerifyRequest(BaseModel):
    attempt_id: str
    topic: str
    code_snippet: str
    exit_exam_question: str
    options: List[str]
    correct_option_index: int
    distractor_explanation: str
    trace_steps: List[Dict[str, Any]]

# Blueprint-aligned exam topics (Ensuring sequence-safe C++ rules)
EXAM_TOPICS = {
    "cpp-programming": [
        "Increment/decrement: ++w + 2, w-- + 2, ++A - B",
        "Loop tracing with counters",
        "Arrays: indexing, traversal, modification",
        "Pointers: *p, p+2, *(p-1), arrays and pointers",
        "Functions: pass by value vs reference",
        "Recursion: call sequence, final value",
        "Nested loops"
    ],
    "oop": [
        "Constructor execution order",
        "Inheritance tracing",
        "Method overriding",
        "Polymorphism",
        "this/super keywords"
    ],
    "dsa-trace": [
        "Stack operations (push/pop)",
        "Queue operations (enqueue/dequeue)",
        "Tree traversal",
        "Linked list operations",
        "Sorting trace"
    ]
}


def get_groq_client() -> Groq:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_API_KEY is missing in server environment variables."
        )
    return Groq(api_key=api_key)

def get_daily_drill_count(user_id: Any, db: Session) -> int:
    today_utc = datetime.now(timezone.utc).date()
    return db.query(DrillAttempt).filter(
        DrillAttempt.student_id == user_id,
        func.date(DrillAttempt.created_at) == today_utc
    ).count()

def clean_json_content(content: str) -> str:
    """Aggressively clean AI response to extract valid JSON."""
    if not content:
        return "{}"
    
    content = content.strip()
    
    # Remove markdown
    content = re.sub(r"`json", "", content)
    content = re.sub(r"`", "", content)
    
    # Find JSON object boundaries
    json_start = content.find('{')
    json_end = content.rfind('}')
    
    if json_start != -1 and json_end != -1 and json_end > json_start:
        content = content[json_start:json_end+1]
    
    # Fix common JSON issues
    content = re.sub(r"'", '"', content)  # Replace single quotes
    content = re.sub(r"None", "null", content)  # Python None -> JSON null
    content = re.sub(r"True", "true", content)  # Python True -> JSON true
    content = re.sub(r"False", "false", content)  # Python False -> JSON false
    
    return content.strip()


def parse_json_safely(content: str) -> dict:
    """Try multiple strategies to parse JSON from AI response."""
    # Strategy 1: Direct parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    
    # Strategy 2: Find JSON object
    try:
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except json.JSONDecodeError:
        pass
    
    # Strategy 3: Extract key fields manually
    try:
        result = {}
        # Extract code_snippet
        code_match = re.search(r'"code_snippet"\s*:\s*"([^"]*)"', content, re.DOTALL)
        if code_match:
            result['code_snippet'] = code_match.group(1).replace('\\n', '\n')
        
        # Extract question
        q_match = re.search(r'"exit_exam_question"\s*:\s*"([^"]*)"', content)
        if q_match:
            result['exit_exam_question'] = q_match.group(1)
        
        # Extract options
        opts_match = re.search(r'"options"\s*:\s*\[(.*?)\]', content, re.DOTALL)
        if opts_match:
            opts_str = opts_match.group(1)
            options = re.findall(r'"([^"]*)"', opts_str)
            result['options'] = options
        
        # Extract correct option
        correct_match = re.search(r'"correct_option_index"\s*:\s*(\d+)', content)
        if correct_match:
            result['correct_option_index'] = int(correct_match.group(1))
        
        # Extract topic and subject
        topic_match = re.search(r'"topic"\s*:\s*"([^"]*)"', content)
        if topic_match:
            result['topic'] = topic_match.group(1)
        
        subject_match = re.search(r'"subject"\s*:\s*"([^"]*)"', content)
        if subject_match:
            result['subject'] = subject_match.group(1)
        
        # Extract trace_steps
        steps_match = re.search(r'"trace_steps"\s*:\s*\[(.*?)\]', content, re.DOTALL)
        if steps_match:
            steps_str = steps_match.group(1)
            # Extract individual steps
            step_matches = re.findall(r'\{[^}]+\}', steps_str)
            trace_steps = []
            for step_str in step_matches:
                step = {}
                line_match = re.search(r'"line_number"\s*:\s*(\d+)', step_str)
                if line_match:
                    step['line_number'] = int(line_match.group(1))
                exp_match = re.search(r'"explanation"\s*:\s*"([^"]*)"', step_str)
                if exp_match:
                    step['explanation'] = exp_match.group(1)
                stdout_match = re.search(r'"stdout_so_far"\s*:\s*"([^"]*)"', step_str)
                if stdout_match:
                    step['stdout_so_far'] = stdout_match.group(1)
                trace_steps.append(step)
            result['trace_steps'] = trace_steps
        
        result['language'] = 'cpp'
        result['total_steps'] = len(result.get('trace_steps', []))
        result['distractor_explanation'] = ''
        
        if result:
            return result
    except Exception:
        pass
    
    return {}


# ============================== Admin Drill Management ==============================

@router.post("/admin/generate")
def admin_generate_drills(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin can generate drills using AI or paste from external AI."""
    from app.models.code_trace_drill import CodeTraceDrill
    
    drills = payload.get("drills", [])
    if not drills:
        raise HTTPException(400, "No drills provided")
    
    created = 0
    for drill in drills:
        new_drill = CodeTraceDrill(
            subject=drill.get("subject", "cpp-programming"),
            topic=drill.get("topic", ""),
            code_snippet=drill.get("code_snippet", ""),
            language=drill.get("language", "cpp"),
            total_steps=drill.get("total_steps", 4),
            trace_steps=drill.get("trace_steps", []),
            exit_exam_question=drill.get("exit_exam_question", ""),
            options=drill.get("options", []),
            correct_option_index=drill.get("correct_option_index", 0),
            distractor_explanation=drill.get("distractor_explanation", ""),
            difficulty=drill.get("difficulty", "medium"),
            priority=drill.get("priority", "HIGH"),
            status="DRAFT",
            source_type=drill.get("source_type", "manual_paste"),
            created_by_id=current_user.id
        )
        db.add(new_drill)
        created += 1
    
    db.commit()
    return {"message": f"Created {created} drills", "created": created}


@router.get("/admin/list")
def admin_list_drills(
    subject: str = "all",
    status_filter: str = "all",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin can list all drills with filters."""
    from app.models.code_trace_drill import CodeTraceDrill
    
    query = db.query(CodeTraceDrill)
    
    if subject != "all":
        query = query.filter(CodeTraceDrill.subject == subject)
    if status_filter != "all":
        query = query.filter(CodeTraceDrill.status == status_filter)
    
    drills = query.order_by(CodeTraceDrill.created_at.desc()).all()
    
    return {
        "total": len(drills),
        "drills": [
            {
                "id": str(d.id),
                "subject": d.subject,
                "topic": d.topic,
                "difficulty": d.difficulty,
                "priority": d.priority,
                "status": d.status,
                "source_type": d.source_type,
                "created_at": d.created_at.isoformat() if d.created_at else None
            }
            for d in drills
        ]
    }


@router.post("/admin/approve-all")
def admin_approve_all_drills(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve ALL DRAFT drills."""
    from app.models.code_trace_drill import CodeTraceDrill
    
    updated = db.query(CodeTraceDrill).filter(
        CodeTraceDrill.status == "DRAFT"
    ).update({"status": "APPROVED", "reviewed_by_id": current_user.id, "reviewed_at": datetime.utcnow()})
    
    db.commit()
    return {"message": f"Approved {updated} drills!", "approved_count": updated}


@router.post("/admin/{drill_id}/approve")
def admin_approve_drill(
    drill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin approves a DRAFT drill."""
    from app.models.code_trace_drill import CodeTraceDrill
    import uuid as uuid_module
    
    drill = db.get(CodeTraceDrill, uuid_module.UUID(drill_id))
    if not drill:
        raise HTTPException(404, "Drill not found")
    
    drill.status = "APPROVED"
    drill.reviewed_by_id = current_user.id
    drill.reviewed_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Drill approved", "id": drill_id}


@router.post("/admin/{drill_id}/reject")
def admin_reject_drill(
    drill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin rejects a DRAFT drill."""
    from app.models.code_trace_drill import CodeTraceDrill
    import uuid as uuid_module
    
    drill = db.get(CodeTraceDrill, uuid_module.UUID(drill_id))
    if not drill:
        raise HTTPException(404, "Drill not found")
    
    drill.status = "REJECTED"
    drill.reviewed_by_id = current_user.id
    drill.reviewed_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Drill rejected", "id": drill_id}


@router.delete("/admin/{drill_id}")
def admin_delete_drill(
    drill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin deletes a drill."""
    from app.models.code_trace_drill import CodeTraceDrill
    import uuid as uuid_module
    
    drill = db.get(CodeTraceDrill, uuid_module.UUID(drill_id))
    if not drill:
        raise HTTPException(404, "Drill not found")
    
    db.delete(drill)
    db.commit()
    
    return {"message": "Drill deleted", "id": drill_id}


@router.post("/admin/export-prompt")
def admin_export_drill_prompt(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export subject-specific prompt for ChatGPT."""
    subject = payload.get("subject", "cpp-programming")
    count = payload.get("count", 10)
    difficulty = payload.get("difficulty", "medium")
    
    if subject == "cpp-programming":
        prompt = f"""Generate {count} C++ code OUTPUT questions for Ethiopian CS Exit Exam.
Difficulty: {difficulty}

FOCUS PATTERNS (from real 2015/2024/2025 exit exams):
1. Increment/decrement: ++w + 2, w-- + 2, ++A - B
2. Loop tracing: for, while, nested loops with counters
3. Arrays: indexing, traversal, modifying elements
4. Pointers: *p, p+2, *(p-1), arrays and pointers
5. Functions: pass by value vs reference, return values
6. Recursion: call sequence, final returned value

EACH QUESTION MUST HAVE:
- C++ code snippet (5-12 lines)
- 4 multiple choice options
- Correct answer index (0-3)
- Step-by-step trace explanation
- Distractor explanation

FORMAT: Return ONLY a JSON array of {count} questions with fields:
subject, topic, code_snippet, language, total_steps, trace_steps (array of strings), exit_exam_question, options (array), correct_option_index, distractor_explanation, difficulty, priority"""
    
    elif subject == "oop":
        prompt = f"""Generate {count} Java OOP OUTPUT/TRACING questions for Ethiopian CS Exit Exam.
Difficulty: {difficulty}

FOCUS PATTERNS (from real exit exams):
1. Constructor execution order (base class first, then derived)
2. Inheritance tracing (which method gets called?)
3. Method overriding and polymorphism (runtime binding)
4. this/super keyword behavior
5. Static vs instance variables
6. Exception handling order

EACH QUESTION MUST HAVE:
- Java code snippet (5-15 lines)
- 4 multiple choice options
- Correct answer index (0-3)
- Constructor/method call sequence explanation
- Distractor explanation

FORMAT: Return ONLY a JSON array of {count} questions with fields:
subject, topic, code_snippet, language, total_steps, trace_steps (array of strings), exit_exam_question, options (array), correct_option_index, distractor_explanation, difficulty, priority"""
    
    else:  # dsa-trace
        prompt = f"""Generate {count} DSA TRACING questions for Ethiopian CS Exit Exam.
Difficulty: {difficulty}
Use PSEUDOCODE (language-independent).

FOCUS PATTERNS:
1. Stack operations (push/pop sequence, top pointer)
2. Queue operations (enqueue/dequeue, front/rear)
3. Tree traversal (preorder, inorder, postorder)
4. Linked list operations (insert, delete, traversal)
5. Sorting trace (bubble, insertion, selection)
6. Binary search steps
7. Recursion trace (factorial, fibonacci)

EACH QUESTION MUST HAVE:
- Pseudocode (5-15 lines)
- 4 multiple choice options
- Correct answer index (0-3)
- Step-by-step execution trace
- Distractor explanation

FORMAT: Return ONLY a JSON array of {count} questions with fields:
subject, topic, code_snippet, language, total_steps, trace_steps (array of strings), exit_exam_question, options (array), correct_option_index, distractor_explanation, difficulty, priority"""
    
    return {"prompt": prompt}


@router.post("/admin/{drill_id}/approve")
def admin_approve_drill(
    drill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin approves a DRAFT drill."""
    from app.models.code_trace_drill import CodeTraceDrill
    import uuid as uuid_module
    
    drill = db.get(CodeTraceDrill, uuid_module.UUID(drill_id))
    if not drill:
        raise HTTPException(404, "Drill not found")
    
    drill.status = "APPROVED"
    drill.reviewed_by_id = current_user.id
    drill.reviewed_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Drill approved", "id": drill_id}


@router.post("/admin/{drill_id}/reject")
def admin_reject_drill(
    drill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin rejects a DRAFT drill."""
    from app.models.code_trace_drill import CodeTraceDrill
    import uuid as uuid_module
    
    drill = db.get(CodeTraceDrill, uuid_module.UUID(drill_id))
    if not drill:
        raise HTTPException(404, "Drill not found")
    
    drill.status = "REJECTED"
    drill.reviewed_by_id = current_user.id
    drill.reviewed_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Drill rejected", "id": drill_id}


@router.delete("/admin/{drill_id}")
def admin_delete_drill(
    drill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin deletes a drill."""
    from app.models.code_trace_drill import CodeTraceDrill
    import uuid as uuid_module
    
    drill = db.get(CodeTraceDrill, uuid_module.UUID(drill_id))
    if not drill:
        raise HTTPException(404, "Drill not found")
    
    db.delete(drill)
    db.commit()
    
    return {"message": "Drill deleted", "id": drill_id}


@router.post("/admin/export-prompt")
def admin_export_drill_prompt(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export prompt for Claude/ChatGPT to generate high-quality drills."""
    subject = payload.get("subject", "cpp-programming")
    count = payload.get("count", 10)
    difficulty = payload.get("difficulty", "medium")
    
    # Language-specific prompts
    if subject == "cpp-programming":
        language_instruction = "C++"
        focus = "increment/decrement, loops, arrays, pointers, functions"
    elif subject == "oop":
        language_instruction = "Java"
        focus = "constructor execution, inheritance, method overriding, polymorphism"
    else:  # dsa-trace
        language_instruction = "pseudocode"
        focus = "stack, queue, tree traversal, linked list operations"
    
    prompt = f"""Generate {count} {language_instruction} output/tracing questions for Ethiopian CS Exit Exam.

SUBJECT: {subject}
DIFFICULTY: {difficulty}
LANGUAGE: {language_instruction}

FOCUS AREAS: {focus}

FOCUS PATTERNS (from real exit exam):
1. Increment/decrement: ++w + 2, w-- + 2, ++A - B
2. Loop tracing with counters
3. Arrays: indexing, traversal, modification
4. Pointers: dereferencing, pointer arithmetic, arrays+pointers
5. Nested loops
6. Functions: parameters, return values
7. Recursion: call sequence, final value

Each question MUST have:
- C++ code snippet (5-12 lines)
- 4 multiple choice options
- Correct answer index (0-3)
- Step-by-step trace explanation
- Distractor explanation

Return JSON array:
[
  {{
    "subject": "{subject}",
    "topic": "Increment/decrement",
    "code_snippet": "#include <iostream>\n...",
    "language": "cpp",
    "total_steps": 4,
    "trace_steps": [...],
    "exit_exam_question": "What is the output?",
    "options": ["A", "B", "C", "D"],
    "correct_option_index": 0,
    "distractor_explanation": "...",
    "difficulty": "{difficulty}",
    "priority": "HIGH"
  }}
]"""
    
    return {"prompt": prompt}


@router.get("/stats")
def get_drill_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get student's drill performance stats."""
    total_attempts = db.query(DrillAttempt).filter(
        DrillAttempt.student_id == current_user.id
    ).count()
    
    correct_attempts = db.query(DrillAttempt).filter(
        DrillAttempt.student_id == current_user.id,
        DrillAttempt.is_correct == True
    ).count()
    
    today = datetime.utcnow().date()
    today_attempts = db.query(DrillAttempt).filter(
        DrillAttempt.student_id == current_user.id,
        DrillAttempt.created_at >= today
    ).count()
    
    accuracy = round((correct_attempts / total_attempts) * 100, 1) if total_attempts > 0 else 0
    
    subject_stats = db.query(
        DrillAttempt.subject_slug,
        func.count(DrillAttempt.id).label('total'),
        func.sum(func.cast(DrillAttempt.is_correct, Integer)).label('correct')
    ).filter(
        DrillAttempt.student_id == current_user.id
    ).group_by(DrillAttempt.subject_slug).all()
    
    subjects = []
    for s in subject_stats:
        subjects.append({
            "subject": s.subject_slug,
            "total": s.total,
            "correct": s.correct or 0,
            "accuracy": round(((s.correct or 0) / s.total) * 100, 1) if s.total > 0 else 0
        })
    
    return {
        "total_attempts": total_attempts,
        "correct_attempts": correct_attempts,
        "accuracy": accuracy,
        "today_attempts": today_attempts,
        "subjects": subjects
    }

@router.get("/recent")
def get_recent_drills(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get student's recent drill attempts."""
    recent = db.query(DrillAttempt).filter(
        DrillAttempt.student_id == current_user.id
    ).order_by(DrillAttempt.created_at.desc()).limit(10).all()
    
    return {
        "attempts": [
            {
                "id": str(a.id),
                "subject": a.subject_slug,
                "is_correct": a.is_correct,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in recent
        ]
    }

@router.post("/code-trace", response_model=CodeTraceResponse)
async def generate_code_trace_drill(
    payload: CodeTraceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get APPROVED drill for student practice."""
    from app.models.code_trace_drill import CodeTraceDrill
    
    # Try to get an APPROVED drill from database
    approved_drills = db.query(CodeTraceDrill).filter(
        CodeTraceDrill.status == "APPROVED",
        CodeTraceDrill.subject == (payload.subject_slug if payload.subject_slug else "cpp-programming")
    ).all()
    
    if approved_drills:
        import random
        drill = random.choice(approved_drills)
        
        # Convert trace_steps to proper format
        trace_steps = []
        raw_steps = drill.trace_steps if isinstance(drill.trace_steps, list) else []
        
        for i, step in enumerate(raw_steps):
            if isinstance(step, dict):
                trace_steps.append(step)
            elif isinstance(step, str):
                # Convert string step to object
                trace_steps.append({
                    "line_number": i + 1,
                    "variables": {},
                    "stdout_so_far": "",
                    "explanation": step
                })
        
        # Ensure total_steps matches
        total_steps = len(trace_steps) if trace_steps else drill.total_steps
        
        return {
            "subject": drill.subject,
            "topic": drill.topic,
            "code_snippet": drill.code_snippet,
            "language": drill.language,
            "total_steps": total_steps,
            "trace_steps": trace_steps,
            "exit_exam_question": drill.exit_exam_question,
            "options": drill.options,
            "correct_option_index": drill.correct_option_index,
            "distractor_explanation": drill.distractor_explanation,
            "attempt_id": str(drill.id),  # Use drill ID as attempt ID
            "subscription_tier": "FREE",
            "drills_remaining_today": 3
        }
    
    # Fallback to AI generation if no approved drills
    return await generate_code_trace_drill_original(payload, current_user, db)


async def generate_code_trace_drill_original(
    payload: CodeTraceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    FREE_DAILY_LIMIT = 3
    remaining_drills = None

    # Get user tier (handle enum)
    raw_tier = getattr(current_user, "subscription_tier", None)
    if raw_tier:
        tier_str = str(raw_tier).lower()
        if "premium" in tier_str:
            user_tier = "PREMIUM"
        else:
            user_tier = "FREE"
    else:
        user_tier = "FREE"
    
    # Check for admin role using multiple possible attribute names
    # Check for admin role (handles UserRole enum)
    user_role = getattr(current_user, "role", None)
    role_str = str(user_role).lower()
    
    # Admin bypasses premium gating
    if "admin" in role_str or role_str == "userrole.admin":
        user_tier = "PREMIUM"
    
    today_count = get_daily_drill_count(current_user.id, db)

    if user_tier == "FREE":
        if today_count >= FREE_DAILY_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Daily free limit reached (3/3 drills used). Upgrade to PREMIUM for unlimited code trace drills."
            )
        remaining_drills = FREE_DAILY_LIMIT - (today_count + 1)

    # Map old subjects to new ones
    subject_map = {
        "cpp-operators": "cpp-programming",
        "cpp-pointers": "cpp-programming",
        "cpp-oop": "oop",
        "cpp-tricks": "cpp-programming",
        "dsa-trace": "dsa-trace",
        "os-concurrency": "dsa-trace",
        "dbms-sql": "dsa-trace",
    }
    selected_slug = subject_map.get(payload.subject_slug, payload.subject_slug if payload.subject_slug in EXAM_TOPICS else "cpp-programming")
    sub_topic = random.choice(EXAM_TOPICS[selected_slug])
    unique_nonce = f"{int(time.time() * 1000)}-{random.randint(10000, 99999)}"

    system_prompt = f"""
    You are an official Ethiopian University Computer Science Exit Exam Question Setter.
    Generate a BRAND NEW, HIGHLY UNIQUE code-tracing question for the topic: "{sub_topic}".

    STRICT RULES FOR CODE GENERATION:
    1. Separate code lines using standard backslash-n (\\n) characters.
    2. Write clean, deterministic C++ code (5 to 12 lines).
    3. ABSOLUTELY NO UNDEFINED BEHAVIOR.
    4. Trace line-by-line variable state AND terminal output in trace_steps.
    5. stdout_so_far must represent cumulative output up to that line.

    Return ONLY valid JSON. No markdown, no code blocks, no explanations.
    The response MUST be a single JSON object starting with {{ and ending with }}.
    Do NOT wrap in triple backticks.

    JSON structure:
    {{
      "subject": "{selected_slug.upper()}",
      "topic": "{sub_topic}",
      "code_snippet": "#include <iostream>\\nusing namespace std;\\n\\nint main() {{\\n    int a = 5;\\n    int b = ++a;\\n    int c = a++;\\n    cout << a << \\" \\" << b << \\" \\" << c;\\n    return 0;\\n}}",
      "language": "cpp",
      "total_steps": 6,
      "trace_steps": [
        {{
          "line_number": 5,
          "variables": {{"a": "5"}},
          "stdout_so_far": "",
          "explanation": "Variable 'a' initialized to 5."
        }},
        {{
          "line_number": 6,
          "variables": {{"a": "6", "b": "6"}},
          "stdout_so_far": "",
          "explanation": "Pre-increment ++a updates 'a' to 6, then assigns 6 to 'b'."
        }}
      ],
      "exit_exam_question": "What is the exact terminal output of this C++ program?",
      "options": ["7 6 6", "6 6 5", "7 5 6", "6 5 5"],
      "correct_option_index": 0,
      "distractor_explanation": "Option A is correct."
    }}
    """

    user_prompt = f"Generate unique code trace drill for: {sub_topic}. Seed: {unique_nonce}"

    try:
        groq_client = get_groq_client()

        response = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.85
        )

        raw_content = response.choices[0].message.content
        content = clean_json_content(raw_content)
        parsed_data = parse_json_safely(content)
        
        if not parsed_data or 'code_snippet' not in parsed_data:
            # Fallback: Generate a simple predefined drill
            parsed_data = {
                "subject": selected_slug.upper(),
                "topic": sub_topic,
                "code_snippet": "#include <iostream>\nusing namespace std;\n\nint main() {\n    int x = 5;\n    int y = ++x;\n    int z = x++;\n    cout << x << \" \" << y << \" \" << z;\n    return 0;\n}",
                "language": "cpp",
                "total_steps": 4,
                "trace_steps": [
                    {"line_number": 5, "variables": {"x": "5"}, "stdout_so_far": "", "explanation": "Initialize x to 5"},
                    {"line_number": 6, "variables": {"x": "6", "y": "6"}, "stdout_so_far": "", "explanation": "Pre-increment x to 6, assign to y"},
                    {"line_number": 7, "variables": {"x": "7", "y": "6", "z": "6"}, "stdout_so_far": "", "explanation": "Post-increment: z gets 6, x becomes 7"},
                    {"line_number": 8, "variables": {"x": "7", "y": "6", "z": "6"}, "stdout_so_far": "7 6 6", "explanation": "Output: x=7, y=6, z=6"}
                ],
                "exit_exam_question": "What is the output of this C++ program?",
                "options": ["7 6 6", "6 6 5", "7 5 6", "6 5 5"],
                "correct_option_index": 0,
                "distractor_explanation": "Pre-increment (++x) updates x first, then assigns. Post-increment (x++) assigns first, then updates."
            }

        if "trace_steps" in parsed_data and isinstance(parsed_data["trace_steps"], list):
            for step in parsed_data["trace_steps"]:
                if "variables" in step and isinstance(step["variables"], dict):
                    step["variables"] = {str(k): str(v) for k, v in step["variables"].items()}

        parsed_data = verify_and_patch_drill(parsed_data)

        new_attempt = DrillAttempt(
            student_id=current_user.id,
            subject_slug=selected_slug
        )
        db.add(new_attempt)
        db.commit()
        db.refresh(new_attempt)

        parsed_data["attempt_id"] = str(new_attempt.id)
        parsed_data["subscription_tier"] = user_tier
        parsed_data["drills_remaining_today"] = remaining_drills

        return parsed_data

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate code trace drill: {str(e)}"
        )

@router.post("/submit", response_model=DrillSubmitResponse)
async def submit_drill_answer(
    payload: DrillSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(DrillAttempt).filter(
        DrillAttempt.id == payload.attempt_id,
        DrillAttempt.student_id == current_user.id
    ).first()

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill attempt session not found."
        )

    attempt.is_correct = payload.is_correct
    if hasattr(payload, "selected_option"):
        attempt.selected_option = payload.selected_option

    db.commit()

    attempts_query = db.query(DrillAttempt).filter(
        DrillAttempt.student_id == current_user.id,
        DrillAttempt.is_correct.isnot(None)
    )
    
    total_attempts = attempts_query.count()
    correct_attempts = attempts_query.filter(DrillAttempt.is_correct == True).count()
    accuracy = round((correct_attempts / total_attempts * 100), 1) if total_attempts > 0 else 0.0

    return DrillSubmitResponse(
        success=True,
        total_attempts=total_attempts,
        correct_attempts=correct_attempts,
        accuracy_percentage=accuracy
    )

@router.post("/run-cpp", response_model=Dict[str, Any])
async def run_raw_cpp(payload: CppVerificationRequest):
    """Direct endpoint to execute arbitrary C++ code and return real output/errors."""
    result = execute_cpp_code(payload.code_snippet, timeout_seconds=payload.timeout_seconds)
    return result.model_dump()

@router.post("/verify-drill", response_model=Dict[str, Any])
async def verify_generated_drill(drill_data: TraceVerifyRequest):
    """Verifies an AI-generated trace drill payload against local g++ before serving to students."""
    verified_drill = verify_and_patch_drill(drill_data.model_dump())
    return verified_drill