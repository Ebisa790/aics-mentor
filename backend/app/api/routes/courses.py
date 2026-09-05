import io
import os
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from celery.result import AsyncResult
from app.models.quiz import Question
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.rate_limit import limiter
from app.models.user import SubscriptionTier, UserRole
from app.core.premium import is_premium_or_admin, truncate_content_for_preview
from app.api.deps import require_admin, get_current_user
from app.models.course import Course, Topic, CourseNotes
from app.models.user import User
from app.models.course_material import CourseMaterial, MaterialContentType
from app.services.ai_service import (
    generate_notes_with_ai,
    extract_course_module_outlines,
    generate_ai_content,
    filter_source_for_course
)
from app.schemas.course import (
    CourseCreate,
    CourseOut,
    CourseDetailOut,
    CourseUpdate,
    TopicCreate,
    TopicOut,
    TopicUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/courses", tags=["courses"])


class AskNoteQuestionRequest(BaseModel):
    question: str
    selected_text: Optional[str] = None
    page_content: Optional[str] = None


MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB limit


def extract_file_text(file: UploadFile) -> str:
    """Extracts raw text content safely with size enforcement and null-byte stripping."""
    filename = os.path.basename(file.filename or "").lower()
    
    content_bytes = file.file.read(MAX_UPLOAD_SIZE_BYTES + 1)
    if len(content_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 15 MB limit."
        )

    extracted_text = ""

    if filename.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content_bytes))
            
            extracted_pages = []
            max_pages = min(len(reader.pages), 50)
            for i in range(max_pages):
                text = reader.pages[i].extract_text()
                if text:
                    extracted_pages.append(text)
            
            extracted_text = "\n".join(extracted_pages)
        except Exception as e:
            logger.error(f"PDF Extraction failed for file {filename}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract text from PDF. The file may be corrupt or encrypted."
            )
    else:
        try:
            extracted_text = content_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to decode file text: {str(e)}"
            )

    return extracted_text.replace("\x00", "").strip()


# -------------------------------------------------------------------
# Ethiopian MoE Exit Exam Blueprint Mapping Engine
# -------------------------------------------------------------------
def get_subject_specific_blueprint(course_code: str, course_name: str) -> dict:
    """Maps course to official Ethiopian MoE Exit Exam Blueprint themes and competencies."""
    code_upper = course_code.upper()
    name_lower = course_name.lower()

    if any(k in code_upper or k in name_lower for k in ["SOFT", "WEB", "DB", "DATABASE", "SQL", "SYSTEM DEVELOPMENT"]):
        return {
            "theme": "System Development (MoE Blueprint)",
            "outcomes": "Use case modeling, requirements engineering, 3-tier web architecture, client/server protocols, relational algebra, SQL optimization, 1NF-BCNF normalization, concurrency control, and distributed DB recovery.",
            "exam_focus": "Contrast Client vs Server side execution, SQL join performance, ER diagram to schema transformation, and transaction ACID properties."
        }
    elif any(k in code_upper or k in name_lower for k in ["ALGO", "DSA", "DAA", "PROG", "OOP", "STRUCTURE", "JAVA", "C++"]):
        return {
            "theme": "Programming and Algorithms (MoE Blueprint)",
            "outcomes": "Big-O time/space complexity analysis, recursion, sorting/searching mechanics, linear vs non-linear data structures (stacks, queues, linked lists, trees, graphs), OOP pillars (polymorphism, inheritance, encapsulation), and dynamic programming vs divide-and-conquer.",
            "exam_focus": "Dry-run code tracing, worst/average case Big-O efficiency comparisons, pointer/reference operations, and class hierarchy memory layout."
        }
    elif any(k in code_upper or k in name_lower for k in ["NET", "COMM", "SEC", "ADMIN", "SYS ADMIN"]):
        return {
            "theme": "Computer Networking and Security (MoE Blueprint)",
            "outcomes": "OSI & TCP/IP stack layers, IP addressing and CIDR subnetting, packet headers, threat vectors/vulnerabilities, symmetric vs asymmetric cryptography, trusted OS requirements, and shell scripting/system administration.",
            "exam_focus": "Subnet mask calculations, header field functions, authentication vs authorization mechanisms, firewall configurations, and protocol port numbers."
        }
    elif any(k in code_upper or k in name_lower for k in ["AI", "INTELLIGENT", "ARTIFICIAL", "SEARCH"]):
        return {
            "theme": "Intelligent Systems (MoE Blueprint)",
            "outcomes": "Knowledge representation, reasoning engines, state-space search heuristics (A*, Minimax, Alpha-Beta pruning), machine learning paradigms, and perception/agent architectures.",
            "exam_focus": "Admissibility and consistency of search heuristics, game tree evaluation, and rule-based inference step analysis."
        }
    elif any(k in code_upper or k in name_lower for k in ["OS", "OPERATING", "ARCH", "ORGANIZATION", "COA"]):
        return {
            "theme": "Computer Architecture and Operating Systems (MoE Blueprint)",
            "outcomes": "Process execution states, CPU scheduling algorithms (preemptive vs non-preemptive), deadlock 4 necessary conditions & prevention/avoidance (Banker's algorithm), virtual memory & page replacement, cache memory mapping, I/O interfacing, and ALU/CU micro-operations.",
            "exam_focus": "Gantt chart execution calculations (Turnaround/Waiting time), page fault counts, deadlock condition identification, and bus hierarchy address calculations."
        }
    elif any(k in code_upper or k in name_lower for k in ["AUTO", "COMPLEXITY", "COMPILER", "THEORY", "GRAMMAR"]):
        return {
            "theme": "Compiler and Complexity (MoE Blueprint)",
            "outcomes": "DFA/NFA conversions, regular expressions, Context-Free Grammars (CFG), Chomsky hierarchy, P vs NP vs NP-Complete complexity classes, lexical analysis (scanners), syntax analysis (LL/LR parsers), and syntax-directed translation.",
            "exam_focus": "Grammar ambiguity testing, state transition table construction, language recognizer limits, and compiler pipeline stage transformations."
        }
    else:
        return {
            "theme": "Core Computer Science Exit Exam Standard",
            "outcomes": "Fundamental theoretical principles, problem-solving methodologies, system specifications, and practical computational mechanics.",
            "exam_focus": "Key concept definitions, structural comparisons, step-by-step algorithms, and common exam traps."
        }


# -------------------------------------------------------------------
# Course Exam Profile Detection
# -------------------------------------------------------------------
def get_course_exam_profile(course_code: str, course_name: str) -> dict:
    """
    Returns COMPLETE exam profile for the EXACT 16 Ethiopian CS Exit Exam courses.
    """
    code_upper = (course_code or "").upper()
    name_lower = (course_name or "").lower()
    
    # ============ 1. SOFTWARE ENGINEERING (CoSc3111) ============
    if 'software engineering' in name_lower or '3111' in code_upper:
        return {
            "profile": "pure_theory",
            "theory_weight": 85,
            "calculation_weight": 0,
            "application_weight": 15,
            "focus": "SDLC models, requirements engineering, design, testing",
            "key_topics": ["SDLC Models", "Requirements Analysis", "System Design", "UML Diagrams", "Testing Types", "Project Management"],
            "question_style": "Model comparison, phase identification, methodology selection",
            "exam_blueprint": "System Development (MoE)",
            "common_traps": ["Agile vs Waterfall", "Verification vs Validation", "White-box vs Black-box"],
            "memory_aids": ["SDLC = Software Development Life Cycle"]
        }
    
    # ============ 2. WEB PROGRAMMING (CoSc3122) ============
    elif 'web programming' in name_lower or '3122' in code_upper:
        return {
            "profile": "pure_theory",
            "theory_weight": 75,
            "calculation_weight": 0,
            "application_weight": 25,
            "focus": "HTML, CSS, JavaScript, HTTP, client-server architecture",
            "key_topics": ["HTML Tags", "CSS Selectors", "JavaScript Basics", "HTTP Methods", "Client-Server", "Web Protocols"],
            "question_style": "HTML tag identification, HTTP method matching, CSS selector explanation",
            "exam_blueprint": "System Development (MoE)",
            "common_traps": ["GET vs POST", "ID vs Class selector", "HTTP vs HTTPS"],
            "memory_aids": ["CRUD for HTTP methods"]
        }
    
    # ============ 3. FUNDAMENTALS OF DATABASE (CoSc2121) ============
    elif 'fundamentals of database' in name_lower or '2121' in code_upper:
        return {
            "profile": "theory_with_sql",
            "theory_weight": 65,
            "calculation_weight": 0,
            "application_weight": 35,
            "focus": "ER modeling, normalization (1NF-3NF), SQL queries",
            "key_topics": ["ER Diagrams", "Normalization", "SQL SELECT", "Joins", "Keys", "Constraints"],
            "question_style": "Normalization problems, SQL query writing, ER diagram interpretation",
            "exam_blueprint": "System Development (MoE)",
            "common_traps": ["1NF vs 2NF vs 3NF", "INNER vs LEFT JOIN", "Primary vs Foreign Key"],
            "memory_aids": ["ACID (Atomicity, Consistency, Isolation, Durability)"]
        }
    
    # ============ 4. ADVANCED DATABASE (CoSc3123) ============
    elif 'advanced database' in name_lower or '3123' in code_upper:
        return {
            "profile": "theory_with_sql",
            "theory_weight": 60,
            "calculation_weight": 0,
            "application_weight": 40,
            "focus": "Transactions, concurrency, indexing, query optimization",
            "key_topics": ["Transactions", "Concurrency Control", "Indexing", "Query Optimization", "Recovery"],
            "question_style": "Transaction state identification, concurrency problem analysis",
            "exam_blueprint": "System Development (MoE)",
            "common_traps": ["ACID vs BASE", "Deadlock vs Starvation"],
            "memory_aids": ["ACID for transactions"]
        }
    
    # ============ 5. COMPUTER PROGRAMMING (CoSc1011) ============
    elif 'computer programming' in name_lower or '1011' in code_upper:
        return {
            "profile": "theory_basic",
            "theory_weight": 80,
            "calculation_weight": 5,
            "application_weight": 15,
            "focus": "Variables, data types, control structures, functions, arrays",
            "key_topics": ["Variables & Types", "Control Structures", "Functions", "Arrays", "Strings", "Basic I/O"],
            "question_style": "Output prediction, syntax identification, code reading",
            "exam_blueprint": "Programming and Algorithms (MoE)",
            "common_traps": ["= vs ==", "Array index 0", "Loop off-by-one"],
            "memory_aids": ["I-R-O (Input-Process-Output)"]
        }
    
    # ============ 6. OOP (CoSc2021) ============
    elif 'object oriented' in name_lower or '2021' in code_upper:
        return {
            "profile": "pure_theory",
            "theory_weight": 85,
            "calculation_weight": 0,
            "application_weight": 15,
            "focus": "OOP pillars, classes, inheritance, polymorphism",
            "key_topics": ["Classes & Objects", "Inheritance", "Polymorphism", "Encapsulation", "Abstraction", "UML"],
            "question_style": "Concept identification, OOP principle explanation",
            "exam_blueprint": "Programming and Algorithms (MoE)",
            "common_traps": ["Overloading vs Overriding", "Abstract vs Interface"],
            "memory_aids": ["A-PIE (Abstraction, Polymorphism, Inheritance, Encapsulation)"]
        }
    
    # ============ 7. DESIGN & ANALYSIS OF ALGORITHMS (CoSc3031) ============
    elif 'design and analysis' in name_lower or '3031' in code_upper:
        return {
            "profile": "theory_with_tracing",
            "theory_weight": 55,
            "calculation_weight": 35,
            "application_weight": 10,
            "focus": "Big-O, divide-conquer, dynamic programming, greedy",
            "key_topics": ["Big-O Notation", "Divide & Conquer", "Dynamic Programming", "Greedy", "Graph Algorithms"],
            "question_style": "Complexity calculation, algorithm selection",
            "exam_blueprint": "Programming and Algorithms (MoE)",
            "common_traps": ["O(n) vs O(log n)", "DP vs Greedy"],
            "memory_aids": ["DP = Divide + Memorize"]
        }
    
    # ============ 8. DSA (CoSc2032) ============
    elif 'data structures' in name_lower or '2032' in code_upper:
        return {
            "profile": "theory_with_tracing",
            "theory_weight": 60,
            "calculation_weight": 25,
            "application_weight": 15,
            "focus": "Arrays, linked lists, stacks, queues, trees, graphs, sorting",
            "key_topics": ["Arrays", "Linked Lists", "Stacks & Queues", "Trees", "Graphs", "Sorting"],
            "question_style": "Code tracing, complexity analysis, structure selection",
            "exam_blueprint": "Programming and Algorithms (MoE)",
            "common_traps": ["Stack vs Queue", "Binary Tree vs BST", "BFS vs DFS"],
            "memory_aids": ["LIFO for Stack"]
        }
    
    # ============ 9. DATA COMMUNICATION (CoSc3211) ============
    elif 'data communication' in name_lower or 'networking' in name_lower or '3211' in code_upper:
        return {
            "profile": "theory_with_calculations",
            "theory_weight": 60,
            "calculation_weight": 30,
            "application_weight": 10,
            "focus": "OSI model, TCP/IP, IP addressing, subnetting",
            "key_topics": ["OSI Layers", "TCP/IP Stack", "IP Addressing", "Subnetting", "Routing", "Protocols"],
            "question_style": "Subnet calculation, protocol identification, OSI layer matching",
            "exam_blueprint": "Computer Networking and Security (MoE)",
            "common_traps": ["OSI vs TCP/IP", "TCP vs UDP", "Classful vs CIDR"],
            "memory_aids": ["Please Do Not Throw Sausage Pizza Away"]
        }
    
    # ============ 10. COMPUTER SECURITY (CoSc3222) ============
    elif 'security' in name_lower or '3222' in code_upper:
        return {
            "profile": "pure_theory",
            "theory_weight": 85,
            "calculation_weight": 0,
            "application_weight": 15,
            "focus": "CIA triad, threats, cryptography, network security",
            "key_topics": ["CIA Triad", "Threats & Attacks", "Cryptography", "Firewalls", "Authentication"],
            "question_style": "Security concept definition, attack identification",
            "exam_blueprint": "Computer Networking and Security (MoE)",
            "common_traps": ["Authentication vs Authorization", "Symmetric vs Asymmetric"],
            "memory_aids": ["CIA (Confidentiality, Integrity, Availability)"]
        }
    
    # ============ 11. NETWORK ADMINISTRATION (CoSc3233) ============
    elif 'administration' in name_lower or '3233' in code_upper:
        return {
            "profile": "theory_basic",
            "theory_weight": 75,
            "calculation_weight": 0,
            "application_weight": 25,
            "focus": "System administration, user management, services",
            "key_topics": ["User Management", "Permissions", "Services", "Backup", "Monitoring"],
            "question_style": "Admin task identification, permission explanation",
            "exam_blueprint": "Computer Networking and Security (MoE)",
            "common_traps": ["chmod vs chown", "root vs user"],
            "memory_aids": ["R-W-X (Read, Write, Execute)"]
        }
    
    # ============ 12. ARTIFICIAL INTELLIGENCE (CoSc4111) ============
    elif 'artificial intelligence' in name_lower or '4111' in code_upper:
        return {
            "profile": "pure_theory",
            "theory_weight": 85,
            "calculation_weight": 5,
            "application_weight": 10,
            "focus": "Search algorithms, knowledge representation, ML basics",
            "key_topics": ["Search (BFS/DFS/A*)", "Knowledge Representation", "Reasoning", "ML Types"],
            "question_style": "Algorithm steps, concept definition",
            "exam_blueprint": "Intelligent Systems (MoE)",
            "common_traps": ["BFS vs DFS", "Supervised vs Unsupervised"],
            "memory_aids": ["BFS uses Queue, DFS uses Stack"]
        }
    
    # ============ 13. OPERATING SYSTEM (CoSc2211) ============
    elif 'operating system' in name_lower or '2211' in code_upper:
        return {
            "profile": "theory_calculation_balanced",
            "theory_weight": 50,
            "calculation_weight": 40,
            "application_weight": 10,
            "focus": "Process management, CPU scheduling, memory, deadlock",
            "key_topics": ["Process States", "Scheduling", "Paging", "Deadlock", "Virtual Memory"],
            "question_style": "Gantt chart calculations, page fault counts",
            "exam_blueprint": "Computer Architecture and Operating Systems (MoE)",
            "common_traps": ["FCFS vs SJF vs RR", "Deadlock vs Starvation"],
            "memory_aids": ["FCFS = First Come First Served"]
        }
    
    # ============ 14. COA (CoSc2222) ============
    elif 'organization' in name_lower or 'architecture' in name_lower or '2222' in code_upper:
        return {
            "profile": "theory_calculation_balanced",
            "theory_weight": 50,
            "calculation_weight": 40,
            "application_weight": 10,
            "focus": "CPU architecture, memory hierarchy, cache, I/O",
            "key_topics": ["CPU Components", "Instruction Cycle", "Cache", "Memory Hierarchy", "I/O"],
            "question_style": "Address calculation, cache mapping",
            "exam_blueprint": "Computer Architecture and Operating Systems (MoE)",
            "common_traps": ["Cache vs RAM", "RISC vs CISC"],
            "memory_aids": ["CPU = Control + ALU + Registers"]
        }
    
    # ============ 15. AUTOMATA & COMPLEXITY (CoSc3311) ============
    elif 'automata' in name_lower or 'complexity' in name_lower or '3311' in code_upper:
        return {
            "profile": "pure_theory",
            "theory_weight": 90,
            "calculation_weight": 5,
            "application_weight": 5,
            "focus": "Finite automata, CFG, Turing machines, complexity classes",
            "key_topics": ["DFA/NFA", "Regular Expressions", "CFG", "PDA", "Turing Machines", "P vs NP"],
            "question_style": "DFA construction, grammar derivation, complexity identification",
            "exam_blueprint": "Compiler and Complexity (MoE)",
            "common_traps": ["DFA vs NFA", "Regular vs Context-Free", "P vs NP"],
            "memory_aids": ["DFA = Deterministic Finite Automata"]
        }
    
    # ============ 16. COMPILER DESIGN (CoSc3322) ============
    elif 'compiler' in name_lower or '3322' in code_upper:
        return {
            "profile": "pure_theory",
            "theory_weight": 85,
            "calculation_weight": 5,
            "application_weight": 10,
            "focus": "Lexical analysis, parsing, semantic analysis, code generation",
            "key_topics": ["Lexical Analysis", "Parsing (LL/LR)", "Semantic Analysis", "Code Generation", "Optimization"],
            "question_style": "Parse tree construction, grammar analysis",
            "exam_blueprint": "Compiler and Complexity (MoE)",
            "common_traps": ["Lexical vs Syntax vs Semantic", "LL vs LR parsing"],
            "memory_aids": ["Lex = tokens, Syntax = grammar"]
        }
    
    # Default
    else:
        return {
            "profile": "balanced",
            "theory_weight": 70,
            "calculation_weight": 20,
            "application_weight": 10,
            "focus": "Core CS concepts",
            "key_topics": ["Core Principles", "Common Algorithms", "System Design"],
            "question_style": "Mixed theory and application",
            "exam_blueprint": "Core CS Standard (MoE)",
            "common_traps": ["General misconceptions"],
            "memory_aids": ["General mnemonics"]
        }


# -------------------------------------------------------------------
# Read-Only Course Endpoints
# -------------------------------------------------------------------
@router.get("", response_model=List[CourseOut], dependencies=[Depends(get_current_user)])
def list_courses(department_id: Optional[uuid.UUID] = None, db: Session = Depends(get_db)):
    """Lists all courses along with total exam question count."""
    query = db.query(
        Course,
        func.count(Question.id).label("question_count")
    ).outerjoin(Question, Course.id == Question.course_id)

    if department_id:
        query = query.filter(Course.department_id == department_id)

    results = query.group_by(Course.id)\
                   .order_by(Course.category, Course.order_index)\
                   .all()

    response_list = []
    for course, q_count in results:
        course_data = {
            "id": course.id,
            "department_id": course.department_id,
            "name": course.name,
            "code": course.code,
            "category": course.category,
            "description": course.description,
            "ects_credits": course.ects_credits,
            "order_index": course.order_index,
            "question_count": q_count
        }
        response_list.append(course_data)

    return response_list


@router.get("/{course_id}", response_model=CourseDetailOut, dependencies=[Depends(get_current_user)])
def get_course(course_id: uuid.UUID, db: Session = Depends(get_db)):
    """Fetches details for a specific course including topics."""
    course = db.query(Course).options(joinedload(Course.topics)).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


# -------------------------------------------------------------------
# Helper: Parse Raw AI Text into Structured Modules
# -------------------------------------------------------------------
def calculate_coverage_score(source_text: str, generated_content: str) -> int:
    """Calculate coverage score (0-100) based on key terms from source."""
    import re
    
    if not source_text or not generated_content:
        return 0
    
    common_words = {
        "the", "and", "that", "have", "for", "not", "with", "you", "this",
        "but", "his", "from", "they", "say", "her", "she", "will", "one",
        "all", "would", "there", "their", "what", "out", "about", "who",
        "get", "which", "when", "make", "can", "like", "time", "just",
        "him", "know", "take", "people", "into", "year", "your", "good",
        "some", "could", "them", "see", "other", "than", "then", "now",
        "look", "only", "come", "its", "over", "think", "also", "back",
        "after", "use", "two", "how", "our", "work", "first", "well",
        "way", "even", "new", "want", "because", "any", "these", "give",
        "day", "most", "us", "is", "are", "was", "were", "been", "being",
        "does", "did", "doing", "this", "these", "those", "with", "without"
    }
    
    source_terms = set()
    words = re.findall(r'\b[a-zA-Z]{5,}\b', source_text.lower())
    for word in words:
        if word not in common_words:
            source_terms.add(word)
    
    if not source_terms:
        return 100
    
    generated_lower = generated_content.lower()
    covered = sum(1 for term in source_terms if term in generated_lower)
    
    return int((covered / len(source_terms)) * 100)


def parse_notes_to_modules(raw_content: str, course_title: str) -> List[dict]:
    """Splits raw LLM content by ---MODULE_BREAK--- into clean frontend modules."""
    raw_chunks = raw_content.split("---MODULE_BREAK---")
    parsed_modules = []
    
    for index, chunk in enumerate(raw_chunks):
        cleaned_chunk = chunk.strip()
        if not cleaned_chunk:
            continue
        
        lines = [line.strip() for line in cleaned_chunk.split("\n") if line.strip()]
        
        extracted_title = f"Module {index + 1}"
        if lines:
            first_line = lines[0].replace("#", "").strip()
            if len(first_line) <= 120:
                extracted_title = first_line

        parsed_modules.append({
            "title": extracted_title,
            "content": cleaned_chunk
        })
    
    if not parsed_modules:
        parsed_modules = [{"title": f"Module 1: {course_title}", "content": raw_content}]
        
    return parsed_modules


def generate_single_module_notes_content(module_title: str, course_title: str, course_code: str, blueprint: dict, source_context: str) -> str:
    """Generates exam-focused, blueprint-aligned study notes with course-specific exam profile."""
    
    # Get exam profile for this course
    exam_profile = get_course_exam_profile(course_code, course_title)
    
    # Build calculation section if needed
    if exam_profile["profile"] in ["theory_calculation_balanced", "theory_with_calculations"]:
        calculation_section = """### Worked Calculations (If Applicable)
**Formula/Method**: [If applicable from source]
**Example Problem**: [From source material]
**Step-by-Step Solution**:**Common Mistakes**: [What students often get wrong]
"""
    else:
        calculation_section = ""
    
    prompt = f"""
You are a Senior Ethiopian CS Exit Exam Professor with 15+ years of experience preparing students for the Ethiopian Ministry of Education CS Exit Exam.

COURSE: {course_title} ({course_code})
MODULE: {module_title}

EXAM PROFILE:
- Theory Weight: {exam_profile['theory_weight']}%
- Calculation Weight: {exam_profile['calculation_weight']}%
- Key Topics: {', '.join(exam_profile['key_topics'])}
- Question Style: {exam_profile['question_style']}

BLUEPRINT: {blueprint.get('theme')}
EXAM FOCUS: {blueprint.get('exam_focus')}

============================================================
SOURCE MATERIAL (YOUR ONLY SOURCE OF TRUTH):
============================================================
{source_context[:25000]}

============================================================
YOUR TASK:
Create COMPREHENSIVE, EXAM-FOCUSED study notes that will help students PASS the Ethiopian CS Exit Exam.

CRITICAL RULES:
1. **SOURCE-FIRST**: 95%+ from source. DO NOT invent anything not in the source.
2. **SIMPLE LANGUAGE**: Write like you're explaining to a struggling student. No complex jargon.
3. **EXAM WEIGHT**: Mark EVERY concept as HIGH (most tested), MEDIUM (sometimes tested), or LOW (rarely tested).
4. **MEMORY AIDS**: Include mnemonics, analogies, and memory tricks for EVERY major concept.
5. **EXAM TRAPS**: Identify what students commonly get WRONG and how to avoid it.
6. **COMMON CONFUSIONS**: Explicitly contrast similar concepts that students mix up.
7. **COMPLETE COVERAGE**: Cover EVERY topic in the source, even minor ones.
8. **COURSE ISOLATION (CRITICAL)**: ONLY {course_title} ({course_code}) content. 
   - IGNORE any content about Operating Systems, Databases, Algorithms, or other CS courses.
   - If the source contains multiple courses, extract ONLY the {course_title} sections.
   - DO NOT mention processes, scheduling, deadlocks, memory management, or any OS topics in Web Programming notes.
   - DO NOT mention normalization, SQL, or ER diagrams in Web Programming notes.
   - Stay STRICTLY within {course_title} scope.

OUTPUT STRUCTURE (FOLLOW EXACTLY):

## {module_title}

### Core Concepts & Definitions
| Concept | Simple Definition | Key Points | Exam Weight |
|---------|------------------|------------|-------------|
| [Concept] | [Simple 1-line definition] | [2-3 key points] | HIGH/MEDIUM/LOW |

### Fundamental Principles
#### Principle 1: [Name]
- **What it is**: [Simple explanation - 1-2 sentences]
- **Why it matters**: [Why this is on the exam]
- **Memory Aid**: [Mnemonic or trick to remember]
- **Example**: [Simple example from source]

#### Principle 2: [Name]
[Same structure]

### Common Confusions (DON'T Mix These Up!)
#### Confusion 1: [Similar Concept A] vs [Similar Concept B]
| Aspect | [A] | [B] |
|--------|-----|-----|
| [Key difference 1] | [A details] | [B details] |
| [Key difference 2] | [A details] | [B details] |
| [Key difference 3] | [A details] | [B details] |

**Memory Trick**: [How to remember which is which]
**Exam Tip**: [How this appears on exam]

#### Confusion 2: [Another Similar Pair]
[Same structure]

### Key Comparisons (If Applicable)
| Aspect | Option A | Option B | How to Remember |
|--------|----------|----------|-----------------|
| [Aspect] | [A details] | [B details] | [Memory trick] |

{calculation_section}
### Common Exam Traps
#### Trap 1: [Trap Name]
- **What students think**: [Common wrong belief]
- **What's actually correct**: [Right answer from source]
- **How to avoid**: [Tip to not fall for this]

#### Trap 2: [Trap Name]
[Same structure]

### Exit Exam Focus Points
- **MOST TESTED**: [The #1 concept from this module]
- **QUESTION PATTERN**: [How this appears on exam]
- **QUICK MEMORY AID**: [Final mnemonic for the whole module]

### Quick Revision Summary
| Topic | Key Fact | Exam Weight |
|-------|----------|-------------|
| [Topic 1] | [1-line summary] | HIGH/MEDIUM/LOW |
| [Topic 2] | [1-line summary] | HIGH/MEDIUM/LOW |
| [Topic 3] | [1-line summary] | HIGH/MEDIUM/LOW |

============================================================
FINAL CHECKLIST:
- Every concept has exam weight (HIGH/MEDIUM/LOW)
- Every major concept has memory aid
- At least 2 common confusions identified
- At least 2 exam traps identified
- All source topics covered
- Simple, clear language
- No invented content
- Focus on {exam_profile['focus']}
"""
    
    system_instruction = (
        f"You are the BEST Ethiopian CS Exit Exam Professor for {course_title} ({course_code}). "
        f"Your students consistently score in the top 10% because your notes are: "
        f"1) SIMPLE - anyone can understand, "
        f"2) EXAM-FOCUSED - only what's tested, "
        f"3) MEMORABLE - mnemonics and tricks, "
        f"4) COMPLETE - covers everything, "
        f"5) CLEAR - contrasts similar concepts. "
        f"Focus: {exam_profile['focus']}. "
        f"Mark exam weights (HIGH/MEDIUM/LOW). Include memory aids. Identify traps. "
        f"Explicitly contrast similar concepts in Common Confusions section. "
        f"Write for students who need to PASS, not become experts."
    )
    
    return generate_notes_with_ai(prompt=prompt, system_instruction=system_instruction).strip()


# -------------------------------------------------------------------
# Ethiopian MoE Exit Exam High-Yield Notes Generation Endpoint
# -------------------------------------------------------------------

@router.post("/{course_id}/notes/ask")
@limiter.limit("20/minute")
def ask_notes_ai(
    course_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI-powered Q&A about course study notes.
    Uses Groq to answer questions based on the selected text and page content.
    """
    from app.core.ai_client import get_groq_client
    
    question = payload.get("question", "").strip()
    selected_text = payload.get("selected_text", "").strip()
    page_content = payload.get("page_content", "").strip()
    
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    client = get_groq_client()
    if not client:
        raise HTTPException(status_code=503, detail="AI service is not configured.")
    
    # Build context from selected text and page content
    context = selected_text if selected_text else page_content
    context = context[:5000]  # Limit context size
    
    system_prompt = f"""You are an AI tutor helping Ethiopian CS students prepare for their Exit Exam.
Course: {course.name}
Code: {getattr(course, 'code', 'CS')}

Answer the student's question based on the provided context. Be clear, concise, and exam-focused.
If the answer isn't in the context, use your general CS knowledge.
Always end with a key takeaway or exam tip."""

    user_prompt = f"Context:\n{context}\n\nQuestion: {question}"
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=800,
        )
        answer = response.choices[0].message.content.strip()
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI request failed: {str(e)[:200]}")


@router.get("/{course_id}/notes", dependencies=[Depends(get_current_user)])
def get_or_generate_course_notes(
    course_id: uuid.UUID,
    regenerate: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # ✅ Add current_user
):
    """
    Generates ultra-focused, high-yield study notes strictly formatted for the 
    Ethiopian National Computer Science Exit Exam Blueprint using chunked generation.
    
    Free users: 20% preview of each module
    Premium/Admin: Full access to all modules
    """
    try:
        course = db.get(Course, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        course_title = getattr(course, 'name', getattr(course, 'title', 'Academic Course'))
        course_code = getattr(course, 'code', 'CS-GENERAL')

        # ✅ Check premium status
        is_premium = is_premium_or_admin(current_user)

        # Students only see APPROVED notes, Admins see all
        if current_user.role == UserRole.ADMIN:
            existing_notes = (
                db.query(CourseNotes)
                .filter(CourseNotes.course_id == course_id)
                .order_by(CourseNotes.version.desc())
                .first()
            )
        else:
            existing_notes = (
                db.query(CourseNotes)
                .filter(
                    CourseNotes.course_id == course_id,
                    CourseNotes.status == "APPROVED"
                )
                .order_by(CourseNotes.version.desc())
                .first()
            )
        
        if existing_notes and not regenerate:
            # ✅ Parse modules and apply preview truncation
            modules = parse_notes_to_modules(existing_notes.content, course_title)
            
            # Apply preview truncation for free users
            if not is_premium:
                preview_modules = []
                for module in modules:
                    preview_content, is_preview = truncate_content_for_preview(
                        module["content"], 
                        is_premium=False, 
                        preview_percentage=0.20
                    )
                    preview_modules.append({
                        "title": module["title"],
                        "content": preview_content,
                        "is_preview": True,
                        "preview_percentage": 20
                    })
                modules = preview_modules
            else:
                # Premium users get full content
                for module in modules:
                    module["is_preview"] = False
                    module["preview_percentage"] = 100
            
            return {
                "id": str(existing_notes.id),
                "course_id": str(existing_notes.course_id),
                "modules": modules,
                "source_type": existing_notes.source_type,
                "created_at": existing_notes.created_at,
                "is_premium_user": is_premium,
                "total_modules": len(modules)
            }

        blueprint = get_subject_specific_blueprint(course_code, course_title)

        materials = db.query(CourseMaterial).filter(CourseMaterial.course_id == course_id).all()
        
        if materials:
            extracted_snippets = [getattr(m, 'extracted_text', None) or getattr(m, 'content', '') for m in materials if m]
            raw_text = "\n\n--- DOCUMENT BOUNDARY ---\n\n".join([t for t in extracted_snippets if t])
            material_text = raw_text[:40000] if len(raw_text) > 40000 else raw_text

            filtered_text = filter_source_for_course(material_text, course_title, course_code)
            source_context = f"PRIMARY SOURCE MATERIAL FOR {course_title.upper()} ({course_code}):\n{filtered_text}"
            source_type = "uploaded_materials"
        else:
            # Use standard syllabus based on course type
            course_lower = course_title.lower()
            code_lower = (course_code or '').lower()
            
            if 'web' in course_lower or '3122' in code_lower:
                syllabus = """Web Programming Exit Exam Syllabus:
- HTML: tags, attributes, forms, semantic elements
- CSS: selectors, box model, flexbox, grid, responsive design
- JavaScript: variables, functions, DOM manipulation, events, AJAX
- HTTP/HTTPS: methods, status codes, headers, cookies, sessions
- Web Architecture: client-server, 3-tier, MVC, REST APIs
- Web Security: XSS, CSRF, SQL injection, authentication"""
            elif 'database' in course_lower or '2121' in code_lower or '3123' in code_lower:
                syllabus = """Database Systems Exit Exam Syllabus:
- Database concepts: DBMS, data models, schema, instances
- ER Modeling: entities, relationships, attributes, cardinality
- Relational Model: relations, keys, constraints, integrity
- Normalization: 1NF, 2NF, 3NF, BCNF, functional dependencies
- SQL: DDL, DML, queries, joins, subqueries, aggregation
- Transactions: ACID properties, concurrency, recovery"""
            elif 'programming' in course_lower or '1011' in code_lower:
                syllabus = """Computer Programming Exit Exam Syllabus:
- Programming basics: variables, data types, operators, expressions
- Control structures: if-else, loops, switch, break, continue
- Functions: declaration, parameters, return values, recursion
- Arrays: 1D, 2D, strings, sorting, searching
- Pointers: memory addresses, pointer arithmetic, dynamic allocation
- File I/O: reading, writing, streams"""
            elif 'object oriented' in course_lower or '2021' in code_lower:
                syllabus = """Object Oriented Programming Exit Exam Syllabus:
- OOP concepts: classes, objects, methods, attributes
- Encapsulation: access modifiers, getters, setters
- Inheritance: base class, derived class, method overriding
- Polymorphism: compile-time, runtime, interfaces, abstract classes
- Abstraction: abstract classes, interfaces
- UML: class diagrams, relationships, design patterns"""
            elif 'algorithm' in course_lower or '3031' in code_lower or '2032' in code_lower:
                syllabus = """Algorithms & Data Structures Exit Exam Syllabus:
- Complexity analysis: Big-O, Omega, Theta, space complexity
- Arrays, Linked Lists, Stacks, Queues
- Trees: binary trees, BST, AVL, heap
- Graphs: BFS, DFS, shortest path, MST
- Sorting: bubble, insertion, selection, merge, quick, heap
- Searching: linear, binary, hash tables
- Algorithm paradigms: divide-conquer, greedy, dynamic programming"""
            elif 'network' in course_lower or 'communication' in course_lower or '3211' in code_lower:
                syllabus = """Networking Exit Exam Syllabus:
- OSI Model: 7 layers, functions, protocols
- TCP/IP: 4 layers, addressing, routing
- IP Addressing: IPv4, IPv6, subnetting, CIDR
- Protocols: TCP, UDP, HTTP, DNS, DHCP, FTP
- Network Devices: router, switch, hub, firewall
- Network Security: threats, encryption, VPN"""
            elif 'security' in course_lower or '3222' in code_lower:
                syllabus = """Computer Security Exit Exam Syllabus:
- Security concepts: CIA triad, threats, vulnerabilities
- Cryptography: symmetric, asymmetric, hash functions
- Network security: firewalls, IDS, VPN, SSL/TLS
- Application security: XSS, CSRF, SQL injection
- Authentication: passwords, biometrics, MFA
- Security policies: access control, auditing"""
            elif 'operating' in course_lower or '2211' in code_lower:
                syllabus = """Operating Systems Exit Exam Syllabus:
- Process management: states, PCB, context switching
- CPU scheduling: FCFS, SJF, Priority, Round Robin
- Deadlock: conditions, prevention, avoidance, Banker's algorithm
- Memory management: paging, segmentation, virtual memory
- File systems: structure, allocation, directory
- I/O systems: device drivers, interrupts"""
            elif 'organization' in course_lower or 'architecture' in course_lower or '2222' in code_lower:
                syllabus = """Computer Organization Exit Exam Syllabus:
- Basic architecture: CPU, memory, I/O, buses
- Instruction execution: fetch, decode, execute
- Memory hierarchy: cache, RAM, secondary storage
- Cache mapping: direct, associative, set-associative
- Pipelining: stages, hazards
- I/O: programmed, interrupt-driven, DMA"""
            elif 'artificial' in course_lower or '4111' in code_lower:
                syllabus = """AI Exit Exam Syllabus:
- AI fundamentals: definition, history, applications
- Search: BFS, DFS, A*, heuristic, minimax
- Knowledge representation: logic, semantic networks, frames
- Reasoning: inference, forward/backward chaining
- Machine learning: supervised, unsupervised, reinforcement
- Neural networks: perceptron, backpropagation"""
            elif 'automata' in course_lower or 'complexity' in course_lower or '3311' in code_lower:
                syllabus = """Automata Theory Exit Exam Syllabus:
- Finite automata: DFA, NFA, conversion
- Regular expressions: patterns, languages
- Context-free grammars: derivation, parse trees
- Pushdown automata: stack, transitions
- Turing machines: computation, halting
- Complexity: P, NP, NP-complete"""
            elif 'compiler' in course_lower or '3322' in code_lower:
                syllabus = """Compiler Design Exit Exam Syllabus:
- Lexical analysis: tokens, regular expressions
- Syntax analysis: CFG, parsing (LL, LR)
- Semantic analysis: type checking, symbol tables
- Intermediate code: three-address code
- Optimization: constant folding, dead code
- Code generation: instruction selection"""
            elif 'software engineering' in course_lower or '3111' in code_lower:
                syllabus = """Software Engineering Exit Exam Syllabus:
- SDLC models: waterfall, agile, spiral
- Requirements: gathering, analysis, specification
- Design: architecture, modules, UML diagrams
- Testing: unit, integration, system, acceptance
- Project management: planning, estimation
- Quality: standards, reviews, documentation"""
            else:
                syllabus = f"Standard Ethiopian CS Exit Exam syllabus for {course_title}."
            
            source_context = f"STANDARD SYLLABUS FOR {course_title.upper()} ({course_code}):\n{syllabus}"
            source_type = "exit_exam_standard"

        # Step 1: Extract 4-6 distinct module titles via Gemini JSON mode
        module_titles = extract_course_module_outlines(course_title, course_code, blueprint, source_context)[:4]

        # Step 2: Generate exhaustive notes for each module individually
        # CHUNK THE SOURCE MATERIAL FOR FULL COVERAGE
        CHUNK_SIZE = 8000  # Smaller chunks to prevent cross-course contamination
        source_chunks = [source_context[i:i+CHUNK_SIZE] for i in range(0, len(source_context), CHUNK_SIZE)] if len(source_context) > CHUNK_SIZE else [source_context]
        
        module_blocks = []
        for m_title in module_titles:
            logger.info(f"Generating chunked exit exam notes for [{course_code}] -> {m_title} (processing {len(source_chunks)} chunks)")
            
            if len(source_chunks) > 1:
                # Generate notes for each chunk and combine
                chunk_notes = []
                for chunk_idx, chunk in enumerate(source_chunks):
                    logger.info(f"  Processing chunk {chunk_idx + 1}/{len(source_chunks)} for {m_title}")
                    chunk_markdown = generate_single_module_notes_content(
                        m_title, course_title, course_code, blueprint, chunk
                    )
                    chunk_notes.append(chunk_markdown)
                module_markdown = "\n\n".join(chunk_notes)
            else:
                module_markdown = generate_single_module_notes_content(
                    m_title, course_title, course_code, blueprint, source_context
                )
            
            module_blocks.append(module_markdown)

        # Step 3: Combine all modules using delimiter
        generated_content = "\n\n---MODULE_BREAK---\n\n".join(module_blocks)

        # Step 4: Persist or update in DB
        if existing_notes:
            existing_notes.content = generated_content
            existing_notes.source_type = source_type
            existing_notes.created_at = datetime.now(timezone.utc)
            existing_notes.coverage_score = calculate_coverage_score(source_context, generated_content)
            db.commit()
            db.refresh(existing_notes)
            active_notes = existing_notes
        else:
            coverage_score = calculate_coverage_score(source_context, generated_content)
            
            active_notes = CourseNotes(
                id=uuid.uuid4(),
                course_id=course_id,
                content=generated_content,
                source_type=source_type,
                created_at=datetime.now(timezone.utc),
                version=1,
                status="DRAFT",
                coverage_score=coverage_score
            )
            db.add(active_notes)
            db.commit()
            db.refresh(active_notes)

        
        modules = parse_notes_to_modules(active_notes.content, course_title)
        
        if not is_premium:
            preview_modules = []
            for module in modules:
                preview_content, is_preview = truncate_content_for_preview(
                    module["content"], 
                    is_premium=False, 
                    preview_percentage=0.20
                )
                preview_modules.append({
                    "title": module["title"],
                    "content": preview_content,
                    "is_preview": True,
                    "preview_percentage": 20
                })
            modules = preview_modules
        else:
            for module in modules:
                module["is_preview"] = False
                module["preview_percentage"] = 100

        return {
            "id": str(active_notes.id),
            "course_id": str(active_notes.course_id),
            "modules": modules,
            "source_type": active_notes.source_type,
            "created_at": active_notes.created_at,
            "is_premium_user": is_premium,
            "total_modules": len(modules)
        }

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating exit exam notes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")


@router.post("/courses/{course_id}/generate")
def start_note_generation(
    course_id: uuid.UUID,
    regenerate: bool = Query(False, description="Force AI re-generation"),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Triggers the Celery background task to generate or regenerate course notes.
    Returns task_id for frontend status tracking.
    """
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # If notes exist and regenerate is False, return existing immediately
    if not regenerate:
        # Students only see APPROVED notes, Admins see all
        if get_current_user.role == UserRole.ADMIN:
            existing_notes = (
                db.query(CourseNotes)
                .filter(CourseNotes.course_id == course_id)
                .order_by(CourseNotes.version.desc())
                .first()
            )
        else:
            existing_notes = (
                db.query(CourseNotes)
                .filter(
                    CourseNotes.course_id == course_id,
                    CourseNotes.status == "APPROVED"
                )
                .order_by(CourseNotes.version.desc())
                .first()
            )
        if existing_notes:
            return {
                "status": "completed",
                "message": "Notes already exist.",
                "notes_id": str(existing_notes.id),
                "task_id": None
            }

    # Dispatch Celery background task
    task = generate_course_notes_task.delay(
        course_id=str(course_id),
        admin_user_id=str(admin_user.id),
        regenerate=regenerate
    )

    return {
        "status": "queued",
        "message": "Course note generation task started.",
        "task_id": task.id
    }


@router.get("/tasks/{task_id}/status")
def get_note_generation_status(
    task_id: str,
    current_user = Depends(get_current_user)
):
    """
    Polls status and meta-step progress for a running note-generation task.
    """
    task_result = AsyncResult(task_id)

    if task_result.state == "PENDING":
        response = {
            "state": task_result.state,
            "step": "Task queued, waiting for worker..."
        }
    elif task_result.state == "PROGRESS":
        response = {
            "state": task_result.state,
            "step": task_result.info.get("step", "Processing...") if isinstance(task_result.info, dict) else "Processing..."
        }
    elif task_result.state == "SUCCESS":
        response = {
            "state": task_result.state,
            "step": "Generation Complete!",
            "result": task_result.result
        }
    else:  # FAILURE or REVOKED
        response = {
            "state": task_result.state,
            "step": "Task failed",
            "error": str(task_result.info)
        }

    return response


# -------------------------------------------------------------------
# Admin Note Review Endpoints
# -------------------------------------------------------------------

@router.get("/{course_id}/notes/review")
def get_notes_for_review(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Admin endpoint to get ALL note versions including drafts for review."""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    notes = (
        db.query(CourseNotes)
        .filter(CourseNotes.course_id == course_id)
        .order_by(CourseNotes.version.desc())
        .all()
    )
    
    if not notes:
        return {
            "course_id": str(course_id),
            "versions": [],
            "message": "No notes generated yet"
        }
    
    result = []
    for note in notes:
        modules = parse_notes_to_modules(note.content, course.name)
        result.append({
            "id": str(note.id),
            "version": note.version,
            "status": note.status,
            "modules": modules,
            "source_type": note.source_type,
            "created_at": note.created_at.isoformat() if note.created_at else None,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
            "reviewed_by_id": str(note.reviewed_by_id) if note.reviewed_by_id else None,
            "reviewed_at": note.reviewed_at.isoformat() if note.reviewed_at else None,
            "review_notes": note.review_notes,
            "coverage_score": note.coverage_score,
            "total_modules": len(modules)
        })
    
    return {
        "course_id": str(course_id),
        "course_name": course.name,
        "course_code": course.code,
        "versions": result,
        "latest_version": notes[0].version if notes else 0
    }


@router.post("/{course_id}/notes/approve")
def approve_course_notes(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Approve the latest DRAFT notes for student access."""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    latest_notes = (
        db.query(CourseNotes)
        .filter(
            CourseNotes.course_id == course_id,
            CourseNotes.status == "DRAFT"
        )
        .order_by(CourseNotes.version.desc())
        .first()
    )
    
    if not latest_notes:
        raise HTTPException(status_code=404, detail="No draft notes to approve")
    
    db.query(CourseNotes).filter(
        CourseNotes.course_id == course_id,
        CourseNotes.status == "APPROVED",
        CourseNotes.id != latest_notes.id
    ).update({"status": "ARCHIVED"})
    
    latest_notes.status = "APPROVED"
    latest_notes.reviewed_by_id = admin_user.id
    latest_notes.reviewed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(latest_notes)
    
    return {
        "message": f"Note version {latest_notes.version} approved successfully",
        "note_id": str(latest_notes.id),
        "version": latest_notes.version,
        "status": latest_notes.status
    }


@router.post("/{course_id}/notes/reject")
def reject_course_notes(
    course_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Reject the latest DRAFT notes with feedback."""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    review_notes = payload.get("review_notes", "")
    
    latest_notes = (
        db.query(CourseNotes)
        .filter(
            CourseNotes.course_id == course_id,
            CourseNotes.status == "DRAFT"
        )
        .order_by(CourseNotes.version.desc())
        .first()
    )
    
    if not latest_notes:
        raise HTTPException(status_code=404, detail="No draft notes to reject")
    
    latest_notes.status = "REJECTED"
    latest_notes.reviewed_by_id = admin_user.id
    latest_notes.reviewed_at = datetime.now(timezone.utc)
    latest_notes.review_notes = review_notes
    
    db.commit()
    
    return {
        "message": f"Note version {latest_notes.version} rejected",
        "note_id": str(latest_notes.id),
        "version": latest_notes.version,
        "status": latest_notes.status
    }


@router.put("/notes/{note_id}/module/{module_index}")
def edit_note_module(
    note_id: uuid.UUID,
    module_index: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Edit a specific module in a note version."""
    note = db.get(CourseNotes, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    new_content = payload.get("content", "")
    if not new_content:
        raise HTTPException(status_code=400, detail="Content is required")
    
    modules = parse_notes_to_modules(note.content, "")
    
    if module_index < 0 or module_index >= len(modules):
        raise HTTPException(status_code=400, detail=f"Module index {module_index} out of range (0-{len(modules)-1})")
    
    modules[module_index]["content"] = new_content
    
    updated_content = "\n\n---MODULE_BREAK---\n\n".join([m["content"] for m in modules])
    
    note.content = updated_content
    note.updated_at = datetime.now(timezone.utc)
    note.reviewed_by_id = admin_user.id
    
    db.commit()
    db.refresh(note)
    
    return {
        "message": f"Module {module_index} updated successfully",
        "note_id": str(note.id),
        "module_index": module_index,
        "module_title": modules[module_index]["title"]
    }


@router.delete("/{course_id}/notes/{note_id}")
def delete_course_notes(
    course_id: uuid.UUID,
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Delete a specific note version."""
    note = db.get(CourseNotes, note_id)
    if not note or note.course_id != course_id:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    
    return {
        "message": f"Note version {note.version} deleted successfully",
        "note_id": str(note_id)
    }


# -------------------------------------------------------------------
# Admin Reopen Rejected Notes
# -------------------------------------------------------------------

@router.post("/{course_id}/notes/reopen")
def reopen_rejected_notes(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Change REJECTED notes back to DRAFT for re-approval."""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    latest_notes = (
        db.query(CourseNotes)
        .filter(
            CourseNotes.course_id == course_id,
            CourseNotes.status == "REJECTED"
        )
        .order_by(CourseNotes.version.desc())
        .first()
    )
    
    if not latest_notes:
        raise HTTPException(status_code=404, detail="No rejected notes found")
    
    latest_notes.status = "DRAFT"
    latest_notes.reviewed_by_id = admin_user.id
    latest_notes.reviewed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(latest_notes)
    
    return {
        "message": "Notes reopened for review. You can now edit and approve them.",
        "note_id": str(latest_notes.id),
        "version": latest_notes.version,
        "status": latest_notes.status
    }


# -------------------------------------------------------------------
# Flashcard Generation from APPROVED Notes
# -------------------------------------------------------------------

@router.post("/{course_id}/flashcards/generate")
def generate_flashcards(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Generate and SAVE flashcards from APPROVED notes."""
    from app.models.flashcard import Flashcard
    
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    approved_notes = (
        db.query(CourseNotes)
        .filter(
            CourseNotes.course_id == course_id,
            CourseNotes.status == "APPROVED"
        )
        .order_by(CourseNotes.version.desc())
        .first()
    )
    
    if not approved_notes:
        raise HTTPException(status_code=404, detail="No approved notes found. Approve notes first.")
    
    # Delete old flashcards
    db.query(Flashcard).filter(Flashcard.course_id == course_id).delete()
    
    modules = parse_notes_to_modules(approved_notes.content, course.name)
    import re
    
    created_count = 0
    seen = set()
    
    for module_idx, module in enumerate(modules):
        content = module["content"]
        
        # Extract from TABLE format: | Concept | Definition | Weight |
        for line in content.split('\n'):
            if '|' in line and line.strip().startswith('|'):
                cells = [c.strip() for c in line.split('|')[1:-1]]
                if len(cells) >= 2:
                    concept = cells[0]
                    definition = cells[1]
                    
                    if concept.lower() in ['concept', 'term', 'definition', '---', '']:
                        continue
                    if len(concept) < 2 or len(definition) < 2:
                        continue
                    
                    exam_weight = "MEDIUM"
                    if len(cells) >= 3:
                        weight_text = cells[2].upper()
                        if 'HIGH' in weight_text:
                            exam_weight = "HIGH"
                        elif 'LOW' in weight_text:
                            exam_weight = "LOW"
                    
                    # Clean concept and definition
                    concept = concept.replace('**', '').strip()
                    definition = definition.replace('**', '').strip()
                    
                    # Skip invalid entries
                    if '---' in concept or '---' in definition:
                        continue
                    if concept.lower() in ['feature', 'property', 'parameter', 'characteristic', 'comparison parameter', 'tool name']:
                        continue
                    if definition.lower() in ['token generated', 'compiler', ':---']:
                        continue
                    if len(concept) < 3 or len(definition) < 3:
                        continue
                    if concept.startswith('Consider') or concept.startswith('Transform') or concept.startswith('String to'):
                        continue
                    
                    key = concept.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    
                    flashcard = Flashcard(
                        course_id=course_id,
                        note_id=approved_notes.id,
                        front=f"What is {concept}?",
                        back=definition,
                        exam_weight=exam_weight,
                        module_title=module["title"],
                        status="DRAFT",  # Start as DRAFT, admin approves later
                        created_by_id=admin_user.id
                    )
                    db.add(flashcard)
                    created_count += 1
        
        # Extract from BULLET format: * **Term**: Definition
        bullet_pattern = r'\*\s*\*\*(.+?)\*\*\s*[:—]\s*(.+)'
        for match in re.finditer(bullet_pattern, content):
            concept = match.group(1).strip()
            definition = match.group(2).strip()
            
            if len(concept) < 2 or len(definition) < 2:
                continue
            
            key = concept.lower()
            if key in seen:
                continue
            seen.add(key)
            
            flashcard = Flashcard(
                course_id=course_id,
                note_id=approved_notes.id,
                front=f"What is {concept}?",
                back=definition,
                exam_weight="MEDIUM",
                module_title=module["title"],
                status="DRAFT",  # Start as DRAFT, admin approves later
                created_by_id=admin_user.id
            )
            db.add(flashcard)
            created_count += 1
        
        # Extract from plain: Term — Definition or Term: Definition
        for line in content.split('\n'):
            line = line.strip()
            if len(line) > 10 and len(line) < 300:
                # Match "Term: Definition" or "Term — Definition"
                match = re.match(r'^([A-Za-z][A-Za-z\s\-]+?)[:—]\s+(.+)$', line)
                if match:
                    concept = match.group(1).strip()
                    definition = match.group(2).strip()
                    
                    if len(concept) < 3 or len(definition) < 3:
                        continue
                    if concept.lower() in ['note', 'example', 'tip', 'remember']:
                        continue
                    
                    # Clean concept and definition
                    concept = concept.replace('**', '').strip()
                    definition = definition.replace('**', '').strip()
                    
                    # Skip invalid entries
                    if '---' in concept or '---' in definition:
                        continue
                    if concept.lower() in ['feature', 'property', 'parameter', 'characteristic', 'comparison parameter', 'tool name']:
                        continue
                    if definition.lower() in ['token generated', 'compiler', ':---']:
                        continue
                    if len(concept) < 3 or len(definition) < 3:
                        continue
                    if concept.startswith('Consider') or concept.startswith('Transform') or concept.startswith('String to'):
                        continue
                    
                    key = concept.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    
                    flashcard = Flashcard(
                        course_id=course_id,
                        note_id=approved_notes.id,
                        front=concept + "?",
                        back=definition,
                        exam_weight="MEDIUM",
                        module_title=module["title"],
                        status="DRAFT",  # Start as DRAFT, admin approves later
                        created_by_id=admin_user.id
                    )
                    db.add(flashcard)
                    created_count += 1
    
    db.commit()
    
    return {
        "message": f"Generated {created_count} flashcards from approved notes!",
        "total_flashcards": created_count,
        "course": course.name
    }


@router.get("/{course_id}/flashcards")
def list_flashcards(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get flashcards for a course with premium gating."""
    from app.models.flashcard import Flashcard
    
    weight_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    
    # Admin sees all, students see only APPROVED
    if current_user.role == UserRole.ADMIN:
        flashcards = (
            db.query(Flashcard)
            .filter(Flashcard.course_id == course_id)
            .all()
        )
    else:
        flashcards = (
            db.query(Flashcard)
            .filter(Flashcard.course_id == course_id, Flashcard.status == "APPROVED")
            .all()
        )
    
    # Sort by exam weight
    flashcards.sort(key=lambda f: weight_order.get(f.exam_weight, 1))
    
    # Premium gating: Free users see only 20% (minimum 10 cards)
    is_premium = current_user.subscription_tier == SubscriptionTier.PREMIUM
    is_admin = current_user.role == UserRole.ADMIN
    
    total_flashcards = len(flashcards)
    limited_flashcards = flashcards
    
    if not is_premium and not is_admin:
        # Free users: 20% of flashcards (minimum 5, maximum 15)
        free_limit = max(5, min(15, int(total_flashcards * 0.20)))
        limited_flashcards = flashcards[:free_limit]
    
    return {
        "course_id": str(course_id),
        "total": total_flashcards,
        "visible_count": len(limited_flashcards),
        "is_premium": is_premium or is_admin,
        "flashcards": [
            {
                "id": str(f.id),
                "front": f.front,
                "back": f.back,
                "exam_weight": f.exam_weight,
                "module_title": f.module_title
            }
            for f in limited_flashcards
        ]
    }


@router.put("/flashcards/{flashcard_id}")
def edit_flashcard(
    flashcard_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Admin can edit a flashcard."""
    from app.models.flashcard import Flashcard
    
    flashcard = db.get(Flashcard, flashcard_id)
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    if "front" in payload:
        flashcard.front = payload["front"]
    if "back" in payload:
        flashcard.back = payload["back"]
    if "exam_weight" in payload:
        flashcard.exam_weight = payload["exam_weight"]
    
    db.commit()
    db.refresh(flashcard)
    
    return {"message": "Flashcard updated", "id": str(flashcard.id)}


@router.delete("/flashcards/{flashcard_id}")
def delete_flashcard(
    flashcard_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Admin can delete a flashcard."""
    from app.models.flashcard import Flashcard
    
    flashcard = db.get(Flashcard, flashcard_id)
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    db.delete(flashcard)
    db.commit()
    
    return {"message": "Flashcard deleted"}


# -------------------------------------------------------------------
# Admin Approve All Flashcards
# -------------------------------------------------------------------

@router.post("/{course_id}/flashcards/approve-all")
def approve_all_flashcards(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Approve all DRAFT flashcards for a course."""
    from app.models.flashcard import Flashcard
    
    updated = (
        db.query(Flashcard)
        .filter(Flashcard.course_id == course_id, Flashcard.status == "DRAFT")
        .update({"status": "APPROVED"})
    )
    db.commit()
    
    return {
        "message": f"Approved {updated} flashcards!",
        "approved_count": updated
    }


# -------------------------------------------------------------------
# Admin Manual Note Upload
# -------------------------------------------------------------------

@router.post("/{course_id}/notes/manual")
def upload_manual_notes(
    course_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Admin can paste pre-written notes from Claude/ChatGPT directly."""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    manual_content = payload.get("content", "")
    if not manual_content or len(manual_content) < 100:
        raise HTTPException(status_code=400, detail="Content is too short. Please provide complete notes.")
    
    db.query(CourseNotes).filter(
        CourseNotes.course_id == course_id,
        CourseNotes.status == "APPROVED"
    ).update({"status": "ARCHIVED"})
    
    new_notes = CourseNotes(
        id=uuid.uuid4(),
        course_id=course_id,
        content=manual_content,
        source_type=payload.get("source_type", "manual_upload"),
        created_at=datetime.now(timezone.utc),
        version=1,
        status="DRAFT",
        reviewed_by_id=admin_user.id,
        coverage_score=100
    )
    
    db.add(new_notes)
    db.commit()
    db.refresh(new_notes)
    
    return {
        "message": "Manual notes uploaded successfully. Review and approve them.",
        "note_id": str(new_notes.id),
        "version": new_notes.version,
        "status": new_notes.status
    }


# -------------------------------------------------------------------
# Admin Export Prompt for External AI
# -------------------------------------------------------------------

@router.post("/{course_id}/notes/export-prompt")
def export_ai_prompt(
    course_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Export the exact prompt to use in Claude/ChatGPT for HUMANIZED notes."""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    module_title = payload.get("module_title", "")
    source_text = payload.get("source_text", "")
    
    exam_profile = get_course_exam_profile(course.code, course.name)
    profile_type = exam_profile.get("profile", "balanced")
    
    prompt = f"""You are a SENIOR CS PROFESSOR with 15+ years teaching experience preparing students for the Ethiopian CS Exit Exam.

COURSE: {course.name} ({course.code})
TOPIC: {module_title}

CONTEXT:
This is for the Ethiopian Ministry of Education Computer Science Exit Exam - a national exam for BSc CS graduates.

SOURCE MATERIAL (use this as your primary reference):
{source_text[:15000]}

WRITING STYLE:
Write like you're explaining to a student in your office. Be natural, direct, and helpful. Not like a textbook. Not like a robot.

STRUCTURE (mix it up naturally - don't make every section look the same):

Start with a brief warm explanation of why this topic matters for the exam.

Then cover the key concepts NATURALLY:
- Explain each concept in 1-2 sentences
- Use a table ONLY when comparing 3+ items
- Mix paragraphs and bullet points
- Add "Remember:" or "Don't forget:" for important points
- Include "Common mistake:" where students often go wrong

For calculations (if applicable), walk through ONE example step-by-step like you're showing a student at a whiteboard.

End with a "Key Takeaways" section - 3-5 bullet points of what students MUST remember.

IMPORTANT RULES:
- Write naturally, like a human professor
- Vary sentence structure (short and long sentences mixed)
- Use contractions (don't, you'll, it's) sometimes
- Don't use the same section headers repeatedly
- Don't make every concept a table row
- Include occasional "Think about it this way..." explanations
- Add personality - you're helping students, not writing a manual
- Keep it focused on what's TESTED, not what's interesting
- Simple language, but not childish

EXAM FOCUS:
- Key Topics: {', '.join(exam_profile['key_topics'])}
- Question Style: {exam_profile['question_style']}
- Common Traps: {exam_profile['common_traps']}

Remember: Students will read this the night before their exam. Make it clear, memorable, and reassuring.
"""
    
    return {"prompt": prompt}



