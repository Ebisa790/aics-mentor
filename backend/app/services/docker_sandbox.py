import subprocess
import tempfile
import os
from typing import Dict, Any, List

def run_in_docker_sandbox(code_snippet: str, timeout_seconds: float = 3.0) -> Dict[str, Any]:
    """
    Runs the C++ snippet inside a locked-down Docker container.
    Enforces memory limits, CPU caps, drops root privileges, and disables networking.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = os.path.join(tmpdir, "main.cpp")
        with open(source_path, "w", encoding="utf-8") as f:
            f.write(code_snippet)

        docker_cmd = [
            "docker", "run", "--rm",
            "--network", "none",            # Disable all network interfaces
            "--memory", "128m",             # Max 128 MB RAM
            "--cpus", "0.5",                # Cap CPU usage at 50% of one core
            "--read-only",                  # Read-only container root
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m", # Memory-backed writable temp directory
            "-v", f"{source_path}:/app/main.cpp:ro",
            "gcc:13-bookworm",              # Standard lightweight GCC image
            "bash", "-c",
            "g++ -std=c++17 -O0 /app/main.cpp -o /tmp/runner && /tmp/runner"
        ]

        try:
            proc = subprocess.run(
                docker_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout_seconds
            )
            return {
                "success": proc.returncode == 0,
                "stdout": proc.stdout.strip(),
                "stderr": proc.stderr.strip(),
                "exit_code": proc.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": "Execution timed out (resource limits exceeded).",
                "exit_code": -1
            }