from typing import Dict, Any
from app.services.cpp_compiler import execute_cpp_code
from app.services.trace_instrumenter import generate_trace_steps

def generate_verified_trace_drill(
    topic: str,
    raw_code_snippet: str,
    llm_generated_meta: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Builds an end-to-end trace drill:
    1. Executes code natively for ground-truth stdout.
    2. Instruments execution via GDB for precise variable/line states.
    3. Merges metadata with LLM exit exam question options & verifies option integrity.
    """
    if not raw_code_snippet or not raw_code_snippet.strip():
        raise ValueError("Code snippet cannot be empty.")

    # 1. Native Compilation & Execution for ground-truth stdout
    exec_result = execute_cpp_code(raw_code_snippet)
    if not exec_result.success:
        err_msg = exec_result.compilation_error or exec_result.runtime_error or "Unknown compiler error"
        raise ValueError(f"Snippet fails compilation or execution: {err_msg}")

    total_stdout = exec_result.stdout.strip() if exec_result.stdout else ""

    # 2. Deterministic Memory & Line Tracing via GDB
    try:
        trace_steps = generate_trace_steps(raw_code_snippet)
    except Exception:
        # Fallback to single final step if GDB is unavailable or tracing fails
        trace_steps = [{
            "line_number": 1,
            "variables": {},
            "explanation": "Trace step auto-generated from stdout.",
            "stdout_so_far": total_stdout
        }]

    # Normalize trace steps and attach progressive stdout to the final step
    for step in trace_steps:
        if "stdout_so_far" not in step or step["stdout_so_far"] is None:
            step["stdout_so_far"] = ""

    if trace_steps:
        trace_steps[-1]["stdout_so_far"] = total_stdout

    # 3. Multiple Choice & Answer Key Verification
    options = llm_generated_meta.get("options", [])
    correct_idx = llm_generated_meta.get("correct_option_index", 0)

    if options and 0 <= correct_idx < len(options):
        # Guarantee correct_option_index points to actual g++ compiler output
        if total_stdout in options:
            correct_idx = options.index(total_stdout)
        else:
            options[correct_idx] = total_stdout

    # 4. Assemble Complete Drill Payload
    drill_payload = {
        "topic": topic,
        "language": "cpp",
        "code_snippet": raw_code_snippet,
        "total_steps": len(trace_steps),
        "trace_steps": trace_steps,
        "exit_exam_question": llm_generated_meta.get("question", "What is the exact terminal output of this code?"),
        "options": options,
        "correct_option_index": correct_idx,
        "distractor_explanation": llm_generated_meta.get("distractor_explanation", ""),
        "verified_by_compiler": True,
        "compiler_stdout": total_stdout,
        "compiler_status": "SUCCESS",
        "compiler_details": None
    }

    return drill_payload