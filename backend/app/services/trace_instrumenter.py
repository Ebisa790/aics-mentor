import os
import re
import subprocess
import tempfile
from typing import List, Dict, Any, TypedDict, Optional

class TraceStepResult(TypedDict):
    line_number: int
    variables: Dict[str, str]
    explanation: str
    stdout_so_far: str


def generate_trace_steps(code_snippet: str, max_steps: int = 50) -> List[Dict[str, Any]]:
    """
    Executes C++ snippet line-by-line using GDB batch mode.
    Extracts line numbers, local variable states, and accumulated stdout.
    """
    trace_steps: List[Dict[str, Any]] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = os.path.join(tmpdir, "main.cpp")
        binary_filename = "executable.exe" if os.name == "nt" else "executable.out"
        binary_path = os.path.join(tmpdir, binary_filename)
        gdb_script_path = os.path.join(tmpdir, "gdb_commands.txt")

        # Save C++ source
        with open(source_path, "w", encoding="utf-8") as f:
            f.write(code_snippet)

        # 1. Compile with Debug Symbols (-g) and No Optimization (-O0)
        compile_cmd = [
            "g++", "-g", "-O0", "-std=c++17",
            "-Wno-sequence-point",
            source_path, "-o", binary_path
        ]
        compile_proc = subprocess.run(compile_cmd, capture_output=True, text=True)
        if compile_proc.returncode != 0:
            raise RuntimeError(f"Compilation failed during tracing: {compile_proc.stderr}")

        # 2. Generate GDB Batch Commands Script
        gdb_commands = [
            "set pagination off",
            "set print pretty off",
            "break main",
            "run",
        ]

        # Add line-by-line stepping commands
        for _ in range(max_steps):
            gdb_commands.append("echo ===STEP_START===\\n")
            gdb_commands.append("frame")
            gdb_commands.append("echo ---VARIABLES---\\n")
            gdb_commands.append("info locals")
            gdb_commands.append("echo ===STEP_END===\\n")
            gdb_commands.append("next")

        gdb_commands.append("quit\n")

        with open(gdb_script_path, "w", encoding="utf-8") as f:
            f.write("\n".join(gdb_commands))

        # 3. Execute GDB in Batch Mode
        gdb_cmd = [
            "gdb", "--batch",
            "-x", gdb_script_path,
            binary_path
        ]
        
        try:
            gdb_proc = subprocess.run(gdb_cmd, capture_output=True, text=True, timeout=10.0)
            gdb_output = gdb_proc.stdout
        except FileNotFoundError:
            raise RuntimeError("gdb is not installed or available in PATH on this server.")
        except subprocess.TimeoutExpired:
            raise RuntimeError("GDB tracing timed out during execution.")

        # 4. Parse GDB Output into Trace Steps
        raw_steps = gdb_output.split("===STEP_START===")
        
        last_line_num: Optional[int] = None
        last_vars: Optional[Dict[str, str]] = None

        for block in raw_steps[1:]:
            if "===STEP_END===" not in block:
                continue

            step_content = block.split("===STEP_END===")[0]
            
            # Extract line number (e.g. "main () at main.cpp:12")
            line_match = re.search(r"main\.cpp:(\d+)", step_content)
            if not line_match:
                continue
            line_num = int(line_match.group(1))

            # Extract local variables
            variables: Dict[str, str] = {}
            if "---VARIABLES---" in step_content:
                vars_block = step_content.split("---VARIABLES---")[1].strip()
                for line in vars_block.splitlines():
                    if "=" in line and not line.startswith("No locals"):
                        parts = line.split("=", 1)
                        var_name = parts[0].strip()
                        var_val = parts[1].strip()
                        variables[var_name] = var_val

            # Skip duplicate steps if line and variables are unchanged
            if line_num == last_line_num and variables == last_vars:
                continue

            last_line_num = line_num
            last_vars = variables

            trace_steps.append({
                "line_number": line_num,
                "variables": variables,
                "explanation": f"Executed line {line_num}.",
                "stdout_so_far": "" # Populated by trace_verifier
            })

            # Terminate trace if process exited
            if "process" in step_content.lower() and "exited" in step_content.lower():
                break

    return trace_steps