"""Seed the official MoE Computer Science Exit Exam blueprint."""
from app.core.database import SessionLocal
from app.models.exam_blueprint import ExamBlueprintItem

# Data extracted from the official MoE Test Blueprint PDF
BLUEPRINT_DATA = [
    # System Development — 27 items total
    {
        "theme": "System Development",
        "course_name": "Software Engineering",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 2,
        "cognitive_apply": 1, "cognitive_analyze": 1,
        "cognitive_evaluate": 1, "cognitive_create": 1,
    },
    {
        "theme": "System Development",
        "course_name": "Web Programming",
        "credit_hours": 4, "test_items": 9,
        "cognitive_remember": 0, "cognitive_understand": 2,
        "cognitive_apply": 2, "cognitive_analyze": 2,
        "cognitive_evaluate": 1, "cognitive_create": 0,
    },
    {
        "theme": "System Development",
        "course_name": "Fundamentals of Database Systems",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 2,
        "cognitive_apply": 1, "cognitive_analyze": 1,
        "cognitive_evaluate": 2, "cognitive_create": 0,
    },
    {
        "theme": "System Development",
        "course_name": "Advanced Database Systems",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 1,
        "cognitive_apply": 2, "cognitive_analyze": 1,
        "cognitive_evaluate": 1, "cognitive_create": 1,
    },

    # Programming and Algorithms — 25 items total
    {
        "theme": "Programming and Algorithms",
        "course_name": "Computer Programming",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 2,
        "cognitive_apply": 2, "cognitive_analyze": 1,
        "cognitive_evaluate": 1, "cognitive_create": 0,
    },
    {
        "theme": "Programming and Algorithms",
        "course_name": "Object Oriented Programming",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 1,
        "cognitive_apply": 2, "cognitive_analyze": 2,
        "cognitive_evaluate": 1, "cognitive_create": 0,
    },
    {
        "theme": "Programming and Algorithms",
        "course_name": "Design and Analysis of Algorithms",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 2,
        "cognitive_apply": 1, "cognitive_analyze": 2,
        "cognitive_evaluate": 1, "cognitive_create": 0,
    },
    {
        "theme": "Programming and Algorithms",
        "course_name": "Data Structures and Algorithms",
        "credit_hours": 3, "test_items": 7,
        "cognitive_remember": 0, "cognitive_understand": 2,
        "cognitive_apply": 1, "cognitive_analyze": 2,
        "cognitive_evaluate": 2, "cognitive_create": 0,
    },

    # Computer Networking and Security — 18 items total
    {
        "theme": "Computer Networking and Security",
        "course_name": "Data Communication and Computer Networking",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 3,
        "cognitive_apply": 1, "cognitive_analyze": 1,
        "cognitive_evaluate": 1, "cognitive_create": 0,
    },
    {
        "theme": "Computer Networking and Security",
        "course_name": "Computer Security",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 2,
        "cognitive_apply": 3, "cognitive_analyze": 1,
        "cognitive_evaluate": 0, "cognitive_create": 0,
    },
    {
        "theme": "Computer Networking and Security",
        "course_name": "Network and System Administration",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 1,
        "cognitive_apply": 1, "cognitive_analyze": 2,
        "cognitive_evaluate": 1, "cognitive_create": 1,
    },

    # Intelligent Systems — 6 items total
    {
        "theme": "Intelligent Systems",
        "course_name": "Introduction to Artificial Intelligence",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 1, "cognitive_understand": 2,
        "cognitive_apply": 1, "cognitive_analyze": 2,
        "cognitive_evaluate": 0, "cognitive_create": 0,
    },

    # Computer Architecture and Operating Systems — 12 items total
    {
        "theme": "Computer Architecture and Operating Systems",
        "course_name": "Operating System",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 1,
        "cognitive_apply": 2, "cognitive_analyze": 1,
        "cognitive_evaluate": 2, "cognitive_create": 0,
    },
    {
        "theme": "Computer Architecture and Operating Systems",
        "course_name": "Computer Organization and Architecture",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 3,
        "cognitive_apply": 0, "cognitive_analyze": 3,
        "cognitive_evaluate": 0, "cognitive_create": 0,
    },

    # Compiler and Complexity — 12 items total
    {
        "theme": "Compiler and Complexity",
        "course_name": "Automata and Complexity Theory",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 0, "cognitive_understand": 4,
        "cognitive_apply": 1, "cognitive_analyze": 1,
        "cognitive_evaluate": 0, "cognitive_create": 0,
    },
    {
        "theme": "Compiler and Complexity",
        "course_name": "Compiler Design",
        "credit_hours": 3, "test_items": 6,
        "cognitive_remember": 1, "cognitive_understand": 2,
        "cognitive_apply": 1, "cognitive_analyze": 2,
        "cognitive_evaluate": 0, "cognitive_create": 0,
    },
]


def seed():
    db = SessionLocal()

    existing = db.query(ExamBlueprintItem).count()
    if existing > 0:
        print(f"SKIP: {existing} rows already exist")
        db.close()
        return

    for order, data in enumerate(BLUEPRINT_DATA):
        item = ExamBlueprintItem(
            **data,
            display_order=order,
        )
        db.add(item)

    db.commit()
    print(f"OK: inserted {len(BLUEPRINT_DATA)} blueprint items")

    # Verify totals
    total_items = sum(d["test_items"] for d in BLUEPRINT_DATA)
    total_credits = sum(d["credit_hours"] for d in BLUEPRINT_DATA)
    print(f"Total items: {total_items} (should be 100)")
    print(f"Total credit hours: {total_credits} (should be 49)")

    db.close()


if __name__ == "__main__":
    seed()