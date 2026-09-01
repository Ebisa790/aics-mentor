import os
import subprocess
import tempfile
from typing import Dict, Any, Optional
from pydantic import BaseModel

class CppExecutionResult(BaseModel):
    success: bool
    stdout: str
    stderr: str
    compilation_error: Optional[str] = None
    runtime_error: Optional[str] = None
    exit_code: int

def execute_cpp_code(
    code_snippet: str, 
    timeout_seconds: float = 2.0, 
    cpp_standard: str = "c++17"
) -> CppExecutionResult:
    """
    Compiles and executes C++ code natively via g++.
    Captures exact stdout, stderr, and trapped signals (e.g. SIGSEGV, SIGFPE, SIGABRT).
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = os.path.join(tmpdir, "main.cpp")
        binary_filename = "executable.exe" if os.name == "nt" else "executable.out"
        binary_path = os.path.join(tmpdir, binary_filename)

        # Write C++ code to temporary source file
        with open(source_path, "w", encoding="utf-8") as f:
            f.write(code_snippet)

        # 1. Compilation Phase
        compile_cmd = [
            "g++",
            f"-std={cpp_standard}",
            "-O0",                   # Disable optimizations to preserve explicit sequence points
            "-Wno-sequence-point",   # Allow evaluation of complex side-effect expressions (e.g. x++ + ++x)
            "-Wall",
            source_path,
            "-o", binary_path
        ]

        try:
            compile_proc = subprocess.run(
                compile_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5.0
            )

            if compile_proc.returncode != 0:
                return CppExecutionResult(
                    success=False,
                    stdout="",
                    stderr="",
                    compilation_error=compile_proc.stderr.strip(),
                    exit_code=compile_proc.returncode
                )
        except subprocess.TimeoutExpired:
            return CppExecutionResult(
                success=False,
                stdout="",
                stderr="",
                compilation_error="Compiler process timed out (exceeded 5 seconds).",
                exit_code=-1
            )
        except FileNotFoundError:
            return CppExecutionResult(
                success=False,
                stdout="",
                stderr="",
                compilation_error="g++ compiler is not installed or not available in PATH.",
                exit_code=-1
            )

        # 2. Execution Phase
        try:
            exec_proc = subprocess.run(
                [binary_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout_seconds
            )

            is_success = exec_proc.returncode == 0
            runtime_err = None if is_success else f"Process exited with code {exec_proc.returncode}"

            # Trap common runtime signals
            if exec_proc.returncode in (-11, 139):
                runtime_err = "Segmentation Fault (SIGSEGV) - Invalid memory access."
            elif exec_proc.returncode in (-8, 136):
                runtime_err = "Floating Point Exception (SIGFPE) - Division by zero."
            elif exec_proc.returncode in (-6, 134):
                runtime_err = "Aborted (SIGABRT) - Assertion failure or uncaught exception."

            return CppExecutionResult(
                success=is_success,
                stdout=exec_proc.stdout,
                stderr=exec_proc.stderr,
                runtime_error=runtime_err,
                exit_code=exec_proc.returncode
            )

        except subprocess.TimeoutExpired:
            return CppExecutionResult(
                success=False,
                stdout="",
                stderr="",
                runtime_error=f"Execution timed out (Limit: {timeout_seconds}s). Infinite loop suspected.",
                exit_code=-1
            )