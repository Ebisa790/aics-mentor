import os
import json
import logging
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import HTTPException, status
from openai import OpenAI
from groq import Groq

load_dotenv()

logger = logging.getLogger(__name__)


def get_openrouter_client() -> Optional[OpenAI]:
    """Get OpenRouter client."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None
    return OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://exitai-ethiopia.local",
            "X-Title": "ExitAI Ethiopia Prep Engine"
        }
    )


def _truncate_for_ai(content: str, max_chars: int = 20000) -> str:
    """Truncate content to stay within Groq token limits (8000 TPM)."""
    if len(content) <= max_chars:
        return content
    return content[:max_chars] + "\n\n... [Content truncated]"


def get_groq_client() -> Optional[Groq]:
    """Get Groq client."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return Groq(api_key=api_key)


def filter_source_for_course(source_text: str, course_title: str, course_code: str) -> str:
    """Filter source material to keep only relevant content for the specific course."""
    course_lower = course_title.lower()
    code_lower = (course_code or '').lower()
    
    if 'web' in course_lower or 'web' in code_lower or '3122' in code_lower:
        keywords_to_filter = ['deadlock', 'process scheduling', 'page fault', 'virtual memory', 'normalization', 'ER diagram', 'SQL query', 'binary tree', 'semaphore', 'thread']
    elif 'database' in course_lower or 'db' in code_lower:
        keywords_to_filter = ['deadlock', 'HTML', 'CSS', 'JavaScript', 'process scheduling', 'page fault', 'subnet mask']
    elif 'operating' in course_lower or 'os' in code_lower:
        keywords_to_filter = ['HTML', 'CSS', 'normalization', 'ER diagram', 'subnet mask', 'JavaScript']
    elif 'algorithm' in course_lower or 'dsa' in code_lower:
        keywords_to_filter = ['HTML', 'CSS', 'normalization', 'subnet mask', 'deadlock', 'page fault']
    else:
        keywords_to_filter = []
    
    if not keywords_to_filter:
        return source_text
    
    lines = source_text.split('\n')
    filtered_lines = []
    
    for line in lines:
        line_lower = line.lower()
        should_skip = any(keyword in line_lower for keyword in keywords_to_filter)
        if not should_skip:
            filtered_lines.append(line)
    
    filtered_text = '\n'.join(filtered_lines)
    
    if len(filtered_text.strip()) < len(source_text.strip()) * 0.3:
        return source_text
    
    return filtered_text


def generate_ai_content(
    prompt: str, 
    system_instruction: Optional[str] = None, 
    response_mime_type: Optional[str] = None
) -> str:
    """Generation engine using Groq as primary."""
    default_system_instruction = (
        "You are an expert Computer Science tutor helping Ethiopian students prepare for their CS Exit Exam. "
        "Answer clearly and educationally."
    )
    active_system_instruction = system_instruction or default_system_instruction

    # Groq
    try:
        groq_client = get_groq_client()
        if groq_client:
                        groq_models = [
                "openai/gpt-oss-20b",
                "openai/gpt-oss-120b",
                "qwen/qwen3.6-27b",
                "allam-2-7b"
            ]
                        
        for groq_model in groq_models:
                try:
                    response = groq_client.chat.completions.create(
                        model=groq_model,
                        messages=[
                            {"role": "system", "content": active_system_instruction},
                            {"role": "user", "content": _truncate_for_ai(prompt)}
                        ],
                        temperature=0.4,
                        max_tokens=2048,
                    )
                    content_result = response.choices[0].message.content
                    if content_result and content_result.strip():
                        logger.info(f"Groq succeeded with {groq_model}")
                        return content_result.strip()
                except Exception as e:
                    logger.warning(f"Groq {groq_model} failed: {e}")
                    continue
    except Exception as e:
        logger.warning(f"Groq setup failed: {e}")

    # OpenRouter fallback
    client = get_openrouter_client()
    if client:
        try:
            response = client.chat.completions.create(
                model="openrouter/free",
                messages=[
                    {"role": "system", "content": active_system_instruction},
                    {"role": "user", "content": _truncate_for_ai(prompt)}
                ],
                temperature=0.4,
                max_tokens=2048,
            )
            generated_content = response.choices[0].message.content
            if generated_content and generated_content.strip():
                logger.info("OpenRouter succeeded")
                return generated_content.strip()
        except Exception as e:
            logger.warning(f"OpenRouter failed: {e}")

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="All AI providers failed. Please try again later."
    )


def generate_notes_with_ai(
    prompt: str, 
    system_instruction: Optional[str] = None, 
    response_mime_type: Optional[str] = None
) -> str:
    """Wrapper function for note generation."""
    return generate_ai_content(
        prompt=prompt, 
        system_instruction=system_instruction, 
        response_mime_type=response_mime_type
    )


def extract_course_module_outlines(
    course_title: str, 
    course_code: str, 
    blueprint: dict, 
    source_context: str
) -> List[str]:
    """Generates 4-6 exam-focused module titles for the SPECIFIC course."""
    prompt = f"""
Identify 4 to 6 exam-focused module titles for: '{course_title}' (Code: {course_code}).

Exam Blueprint Theme: {blueprint.get('theme')}

SOURCE MATERIAL:
{source_context[:3000]}

STRICT RULES:
- ONLY topics for {course_title} ({course_code})
- DO NOT include topics from other CS courses
- Return ONLY a JSON array of strings
"""
    system_instruction = "Return ONLY a raw JSON array of strings. No thinking."
    
    try:
        raw_json = generate_ai_content(prompt=prompt, system_instruction=system_instruction)
        clean_json = raw_json.strip().removeprefix("`json").removeprefix("`").removesuffix("`").strip()
        modules = json.loads(clean_json)
        if isinstance(modules, list) and len(modules) > 0:
            valid_modules = [str(m) for m in modules if '<think>' not in str(m)]
            if valid_modules:
                return valid_modules[:6]
    except Exception as e:
        logger.warning(f"Failed to extract modules: {e}")

    # Fallback modules for ALL 16 courses
    course_lower = course_title.lower()
    code_lower = (course_code or '').lower()
    
    if 'web' in course_lower or '3122' in code_lower:
        return ["Module 1: HTML Fundamentals & Page Structure", "Module 2: CSS Styling & Layout", "Module 3: JavaScript Basics & DOM", "Module 4: Web Protocols & Client-Server Architecture"]
    elif 'fundamentals of database' in course_lower or '2121' in code_lower:
        return ["Module 1: Database Fundamentals & ER Modeling", "Module 2: Relational Model & Normalization", "Module 3: SQL Queries & Operations", "Module 4: Transactions & Concurrency Control"]
    elif 'advanced database' in course_lower or '3123' in code_lower:
        return ["Module 1: Advanced ER Modeling & Design", "Module 2: Query Optimization & Indexing", "Module 3: Transaction Management & Recovery", "Module 4: Distributed Databases & NoSQL"]
    elif 'computer programming' in course_lower or '1011' in code_lower:
        return ["Module 1: Programming Fundamentals & Variables", "Module 2: Control Structures & Functions", "Module 3: Arrays & Strings", "Module 4: Pointers & Memory Management"]
    elif 'object oriented' in course_lower or '2021' in code_lower:
        return ["Module 1: OOP Fundamentals & Classes", "Module 2: Inheritance & Polymorphism", "Module 3: Encapsulation & Abstraction", "Module 4: Design Patterns & UML"]
    elif 'design and analysis' in course_lower or '3031' in code_lower:
        return ["Module 1: Algorithm Analysis & Big-O", "Module 2: Divide & Conquer Algorithms", "Module 3: Dynamic Programming", "Module 4: Greedy Algorithms & Graph Algorithms"]
    elif 'data structures' in course_lower or '2032' in code_lower:
        return ["Module 1: Arrays, Stacks & Queues", "Module 2: Linked Lists & Trees", "Module 3: Graphs & Hash Tables", "Module 4: Sorting & Searching Algorithms"]
    elif 'data communication' in course_lower or 'networking' in course_lower or '3211' in code_lower:
        return ["Module 1: OSI Model & TCP/IP Stack", "Module 2: IP Addressing & Subnetting", "Module 3: Routing & Switching", "Module 4: Network Protocols & Services"]
    elif 'security' in course_lower or '3222' in code_lower:
        return ["Module 1: Security Fundamentals & Threats", "Module 2: Cryptography & Encryption", "Module 3: Network Security & Firewalls", "Module 4: Application Security & Best Practices"]
    elif 'administration' in course_lower or '3233' in code_lower:
        return ["Module 1: System Administration Basics", "Module 2: User & Permission Management", "Module 3: Network Services Configuration", "Module 4: Backup & Recovery"]
    elif 'artificial' in course_lower or '4111' in code_lower:
        return ["Module 1: AI Fundamentals & History", "Module 2: Search Algorithms & Heuristics", "Module 3: Knowledge Representation", "Module 4: Machine Learning Basics"]
    elif 'operating' in course_lower or '2211' in code_lower:
        return ["Module 1: Process Management & Scheduling", "Module 2: Memory Management & Virtual Memory", "Module 3: Deadlock Detection & Prevention", "Module 4: File Systems & I/O Management"]
    elif 'organization' in course_lower or 'architecture' in course_lower or '2222' in code_lower:
        return ["Module 1: Computer Architecture Basics", "Module 2: CPU & Instruction Execution", "Module 3: Memory Hierarchy & Cache", "Module 4: I/O Systems & Buses"]
    elif 'automata' in course_lower or 'complexity' in course_lower or '3311' in code_lower:
        return ["Module 1: Finite Automata & Regular Languages", "Module 2: Context-Free Grammars & Pushdown Automata", "Module 3: Turing Machines & Computability", "Module 4: Complexity Classes (P, NP, NP-Complete)"]
    elif 'compiler' in course_lower or '3322' in code_lower:
        return ["Module 1: Lexical Analysis & Tokenization", "Module 2: Syntax Analysis & Parsing", "Module 3: Semantic Analysis & Type Checking", "Module 4: Code Generation & Optimization"]
    elif 'software engineering' in course_lower or '3111' in code_lower:
        return ["Module 1: SDLC Models & Methodologies", "Module 2: Requirements Engineering", "Module 3: Design Patterns & Architecture", "Module 4: Testing & Quality Assurance"]
    else:
        return [f"Module 1: Core Fundamentals of {course_title}", f"Module 2: Key Concepts & Principles", f"Module 3: Advanced Topics & Applications", f"Module 4: Exam Review & Practice"]
