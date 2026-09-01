from typing import Dict, Any, List
from app.services.cpp_compiler import execute_cpp_code

def verify_and_patch_drill(drill_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes the C++ code snippet against native g++ and cross-checks 
    the AI-generated trace steps and multiple-choice options with real compiler stdout.
    Patches options and correct_option_index if AI hallucinated program output.
    """
    code_snippet = drill_payload.get("code_snippet", "")
    
    # Run code natively via local g++ compiler
    compilation_result = execute_cpp_code(code_snippet)

    # Attach verification metadata
    drill_payload["verified_by_compiler"] = False
    drill_payload["compiler_stdout"] = compilation_result.stdout.strip() if compilation_result.stdout else ""

    if not compilation_result.success:
        if compilation_result.compilation_error:
            drill_payload["compiler_status"] = "COMPILATION_ERROR"
            drill_payload["compiler_details"] = compilation_result.compilation_error
        else:
            drill_payload["compiler_status"] = "RUNTIME_ERROR"
            drill_payload["compiler_details"] = compilation_result.runtime_error
        return drill_payload

    # Compiler executed successfully
    drill_payload["verified_by_compiler"] = True
    drill_payload["compiler_status"] = "SUCCESS"
    drill_payload["compiler_details"] = None
    
    real_output = compilation_result.stdout.strip()
    
    # 1. Normalize stdout_so_far across all trace steps
    trace_steps = drill_payload.get("trace_steps", [])
    for step in trace_steps:
        if "stdout_so_far" not in step or step["stdout_so_far"] is None:
            step["stdout_so_far"] = ""

    # Synchronize the final step's cumulative output with real g++ stdout
    if trace_steps:
        trace_steps[-1]["stdout_so_far"] = real_output

    # 2. Answer Key Patching: Guarantee correct_option_index points to actual g++ output
    options = drill_payload.get("options", [])
    correct_idx = drill_payload.get("correct_option_index", 0)

    if options and 0 <= correct_idx < len(options):
        # If real output exists somewhere in the options array
        if real_output in options:
            drill_payload["correct_option_index"] = options.index(real_output)
        else:
            # If AI hallucinated and didn't include real output, patch the correct option slot
            options[correct_idx] = real_output
            drill_payload["options"] = options

    return drill_payload
