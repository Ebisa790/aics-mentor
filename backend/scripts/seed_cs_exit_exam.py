"""Seeds the 16 official MoE exit-exam courses for BSc Computer Science.

Source: Ministry of Education, "Identified Competency Focus Areas and Core Courses
for Ethiopian Higher Education Institutions' Exit Examination — BSc Computer
Science" (Shumet Tadesse, University of Gondar, July 2022), Table 4-1 and Table 5-1.

Run from backend/:
    python -m scripts.seed_cs_exit_exam

Safe to re-run: courses are upserted by (department, name), so it won't duplicate
rows if you run it again after adding more departments later.

KNOWN DATA ISSUE IN THE SOURCE DOCUMENT: Table 4-1 lists course code "CoSc2041" for
BOTH "Fundamentals of Database Systems" and "Advanced Database Systems". That's very
likely a transcription typo in the original PDF (these should almost certainly be two
different codes), not something specific to this platform. Both are seeded with the
code as printed — cross-check against your university's official course catalog and
update Advanced Database Systems' code once you have the correct value.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, Base, engine
from app.models.department import Department
from app.models.course import Course

CS_DEPARTMENT = {
    "name": "BSc Computer Science",
    "short_name": "CS",
    "description": (
        "Bachelor of Science in Computer Science, per the Ethiopian Ministry of "
        "Education harmonized curriculum."
    ),
}

# theme == Table 5-1 category; code/ects == Table 4-1
COURSES = [
    # Programming and Web Development
    {"code": "CoSc1011", "name": "Computer Programming", "category": "Programming and Web Development", "ects_credits": 5},
    {"code": "CoSc2051", "name": "Object Oriented Programming", "category": "Programming and Web Development", "ects_credits": 5},
    {"code": "CoSc3081", "name": "Web Programming", "category": "Programming and Web Development", "ects_credits": 7},
    # Computer Networking and Security
    {"code": "CoSc2032", "name": "Data Communication and Computer Networking", "category": "Computer Networking and Security", "ects_credits": 5},
    {"code": "CoSc3034", "name": "Wireless Communication and Mobile Computing", "category": "Computer Networking and Security", "ects_credits": 5},
    {"code": "CoSc4035", "name": "Computer Security", "category": "Computer Networking and Security", "ects_credits": 5},
    {"code": "CoSc4036", "name": "Network and System Administration", "category": "Computer Networking and Security", "ects_credits": 5},
    # System Development and Database Systems
    {"code": "CoSc2041", "name": "Fundamentals of Database Systems", "category": "System Development and Database Systems", "ects_credits": 5},
    {"code": "CoSc2041", "name": "Advanced Database Systems", "category": "System Development and Database Systems", "ects_credits": 5},  # source typo, see module docstring
    {"code": "CoSc3061", "name": "Software Engineering", "category": "System Development and Database Systems", "ects_credits": 5},
    # Emerging Technologies and Intelligent Systems
    {"code": "EmTe1012", "name": "Introduction to Emerging Technologies", "category": "Emerging Technologies and Intelligent Systems", "ects_credits": 5},
    {"code": "CoSc3112", "name": "Introduction to Artificial Intelligence", "category": "Emerging Technologies and Intelligent Systems", "ects_credits": 5},
    # Algorithms
    {"code": "CoSc2092", "name": "Data Structures and Algorithms", "category": "Algorithms", "ects_credits": 5},
    {"code": "CoSc3094", "name": "Design and Analysis of Algorithms", "category": "Algorithms", "ects_credits": 5},
    # Computer Architecture and Operating Systems
    {"code": "CoSc3023", "name": "Operating System", "category": "Computer Architecture and Operating Systems", "ects_credits": 5},
    {"code": "CoSc2022", "name": "Computer Organization and Architecture", "category": "Computer Architecture and Operating Systems", "ects_credits": 5},
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        department = db.query(Department).filter(Department.name == CS_DEPARTMENT["name"]).first()
        if department is None:
            department = Department(**CS_DEPARTMENT)
            db.add(department)
            db.flush()
            print(f"Created department: {department.name}")
        else:
            print(f"Department already exists: {department.name}")

        created, skipped = 0, 0
        for idx, course_data in enumerate(COURSES):
            exists = (
                db.query(Course)
                .filter(Course.department_id == department.id, Course.name == course_data["name"])
                .first()
            )
            if exists:
                skipped += 1
                continue
            db.add(Course(department_id=department.id, order_index=idx, **course_data))
            created += 1

        db.commit()
        print(f"Courses created: {created}, already present (skipped): {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
