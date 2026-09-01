"""Seeds a small, real (but non-exhaustive) set of Operating System practice questions.

This is DEMO content, not official MoE material — it exists so you can immediately try
the practice-mode exam generator (POST /api/exams/generate, mode="practice") without
building out a full question bank by hand first. 10 questions (2 beginner / 6
intermediate / 2 advanced) is exactly enough for one practice set; it is NOT enough for
mock mode, which needs 100 questions (20/60/20) per course. Build out the rest via the
admin panel or the bulk CSV/JSON import endpoints
(POST /api/admin/courses/{course_id}/questions/bulk-csv or .../bulk-json).

Run from backend/, after seed_cs_exit_exam.py:
    python -m scripts.seed_sample_questions

Safe to re-run: skips any question whose prompt already exists for the course.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, Base, engine
from app.models.course import Course
from app.models.quiz import DifficultyLevel, Question, QuestionType

COURSE_NAME = "Operating System"

QUESTIONS = [
    # Beginner
    {
        "difficulty": DifficultyLevel.BEGINNER,
        "prompt": "What is the primary role of an operating system?",
        "choices": {
            "A": "To manage hardware resources and provide services to applications",
            "B": "To compile source code into machine code",
            "C": "To design user interfaces for websites",
            "D": "To physically manufacture computer chips",
        },
        "correct_answer": "A",
        "explanation": "The OS mediates between hardware and application software, managing CPU, memory, storage, and I/O.",
    },
    {
        "difficulty": DifficultyLevel.BEGINNER,
        "prompt": "Which of these is an example of a process state?",
        "choices": {"A": "Compiled", "B": "Ready", "C": "Encrypted", "D": "Indexed"},
        "correct_answer": "B",
        "explanation": "The standard process states are New, Ready, Running, Waiting, and Terminated.",
    },
    # Intermediate
    {
        "difficulty": DifficultyLevel.INTERMEDIATE,
        "prompt": "Which scheduling algorithm can cause starvation for long processes?",
        "choices": {
            "A": "First-Come, First-Served (FCFS)",
            "B": "Shortest Job Next (SJN)",
            "C": "Round Robin",
            "D": "First-Come, First-Served with aging",
        },
        "correct_answer": "B",
        "explanation": "SJN always favors shorter jobs, so a long job can be perpetually delayed by a stream of short ones.",
    },
    {
        "difficulty": DifficultyLevel.INTERMEDIATE,
        "prompt": "What is a race condition?",
        "choices": {
            "A": "Two processes competing for CPU priority",
            "B": "An outcome that depends on the non-deterministic timing of concurrent operations",
            "C": "A deadlock between two threads",
            "D": "A process exceeding its allocated time slice",
        },
        "correct_answer": "B",
        "explanation": "A race condition occurs when the correctness of a result depends on the relative timing of events, typically unsynchronized shared-resource access.",
    },
    {
        "difficulty": DifficultyLevel.INTERMEDIATE,
        "prompt": "In virtual memory systems, what does a 'page fault' indicate?",
        "choices": {
            "A": "A corrupted memory page",
            "B": "The requested page is not currently in physical memory",
            "C": "The CPU cache has been invalidated",
            "D": "A hardware failure in RAM",
        },
        "correct_answer": "B",
        "explanation": "A page fault triggers the OS to load the needed page from disk (or backing store) into physical memory.",
    },
    {
        "difficulty": DifficultyLevel.INTERMEDIATE,
        "prompt": "What distinguishes a mutex from a semaphore?",
        "choices": {
            "A": "A mutex allows a count greater than 1; a semaphore does not",
            "B": "A mutex is binary and typically owned by the locking thread; a semaphore can allow multiple holders",
            "C": "They are functionally identical in all implementations",
            "D": "A semaphore can only be used in single-threaded programs",
        },
        "correct_answer": "B",
        "explanation": "A mutex enforces exclusive ownership (usually only the locker can unlock), while a counting semaphore permits a set number of concurrent holders.",
    },
    {
        "difficulty": DifficultyLevel.INTERMEDIATE,
        "prompt": "Which of the following is NOT one of the four necessary conditions for deadlock?",
        "choices": {
            "A": "Mutual exclusion",
            "B": "Hold and wait",
            "C": "Preemption",
            "D": "Circular wait",
        },
        "correct_answer": "C",
        "explanation": "Deadlock requires NO preemption (resources can't be forcibly taken away) — 'preemption' itself is the opposite of a deadlock-necessary condition.",
    },
    {
        "difficulty": DifficultyLevel.INTERMEDIATE,
        "prompt": "What is the purpose of a Translation Lookaside Buffer (TLB)?",
        "choices": {
            "A": "To cache recent virtual-to-physical address translations",
            "B": "To schedule I/O requests",
            "C": "To store the process control block",
            "D": "To manage network packet translation",
        },
        "correct_answer": "A",
        "explanation": "The TLB is a small, fast cache that avoids repeated page-table lookups for recently translated addresses.",
    },
    # Advanced
    {
        "difficulty": DifficultyLevel.ADVANCED,
        "prompt": "In the Banker's Algorithm, what does a 'safe state' guarantee?",
        "choices": {
            "A": "No process will ever request more resources",
            "B": "There exists at least one sequence in which all processes can complete without deadlock",
            "C": "All processes have equal priority",
            "D": "Memory fragmentation is eliminated",
        },
        "correct_answer": "B",
        "explanation": "A safe state means the system can find at least one ordering of process execution that avoids deadlock, even if not all resources are immediately available.",
    },
    {
        "difficulty": DifficultyLevel.ADVANCED,
        "prompt": "Why can priority inversion occur in real-time systems, and what is a standard mitigation?",
        "choices": {
            "A": "It can't occur in correctly designed systems",
            "B": "A low-priority task holds a lock a high-priority task needs; priority inheritance raises the low-priority task's priority temporarily",
            "C": "It only occurs on single-core systems and is fixed by adding more cores",
            "D": "It is caused by insufficient RAM and fixed by increasing swap space",
        },
        "correct_answer": "B",
        "explanation": "Priority inversion happens when a medium-priority task preempts a low-priority task holding a resource a high-priority task needs; priority inheritance temporarily boosts the lock-holder's priority to prevent unbounded delay.",
    },
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.name == COURSE_NAME).first()
        if course is None:
            print(f"Course '{COURSE_NAME}' not found — run scripts/seed_cs_exit_exam.py first.")
            return

        created, skipped = 0, 0
        for q in QUESTIONS:
            exists = db.query(Question).filter(Question.course_id == course.id, Question.prompt == q["prompt"]).first()
            if exists:
                skipped += 1
                continue
            db.add(
                Question(
                    course_id=course.id,
                    question_type=QuestionType.MULTIPLE_CHOICE,
                    difficulty=q["difficulty"],
                    prompt=q["prompt"],
                    choices=q["choices"],
                    correct_answer=q["correct_answer"],
                    explanation=q["explanation"],
                )
            )
            created += 1

        db.commit()
        print(f"Questions created: {created}, already present (skipped): {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
