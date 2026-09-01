from pydantic import BaseModel
from typing import List, Dict, Optional

class TraceStep(BaseModel):
    line_number: int
    variables: Dict[str, str]
    explanation: str
    stdout_so_far: Optional[str] = ""

class CodeTraceRequest(BaseModel):
    subject_slug: Optional[str] = "cpp-pointers"

class CodeTraceResponse(BaseModel):
    attempt_id: str
    subject: str
    topic: str
    code_snippet: str
    language: str
    total_steps: int
    trace_steps: List[TraceStep]
    exit_exam_question: str
    options: List[str]
    correct_option_index: int
    distractor_explanation: str
    subscription_tier: str
    drills_remaining_today: Optional[int] = None
    verified_by_compiler: Optional[bool] = False
    compiler_stdout: Optional[str] = ""
    compiler_status: Optional[str] = None
    compiler_details: Optional[str] = None

class DrillSubmitRequest(BaseModel):
    attempt_id: str
    selected_option: int
    is_correct: bool

class DrillSubmitResponse(BaseModel):
    success: bool
    total_attempts: int
    correct_attempts: int
    accuracy_percentage: float