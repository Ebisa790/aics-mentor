# AI-CS Mentor

A web-based preparation platform for the Ethiopian BSc Computer Science Exit
Examination. Students study curriculum-aligned material, take computer-based mock
exams modeled on the official exam blueprint, and get AI-assisted explanations of
concepts and wrong answers.

**Live demo:** _[add your Vercel URL here]_
**API docs:** _[add your Render URL + /docs here — only works in non-production]_

---

## What it does

The Ethiopian National Exit Exam covers 16 Computer Science courses across six exam
themes. Students preparing for it typically rely on scattered PDFs, disconnected
practice questions, and generic AI chatbots that don't know the curriculum.

This platform pulls all of that into one place:

- **Curriculum-aligned content** — courses, topics, notes, and questions seeded from
  the Ministry of Education's published competency guideline (16 courses, real course
  codes, ECTS credits, official exam themes).
- **Mock exams** — timed, full-screen, blueprint-aligned exams that match the real
  format. Auto-graded with per-topic breakdown.
- **AI tutor** — a chat-based assistant for concept explanations and wrong-answer
  review. Currently uses direct LLM calls; RAG over the question bank is on the
  roadmap.
- **Progress tracking** — per-course mastery, attempt history, and weak-area
  identification.

---

## Tech Stack

| Layer | Stack |
|---|---|
| **Backend** | FastAPI · SQLAlchemy 2.0 · PostgreSQL · Alembic · JWT auth |
| **Frontend** | React 18 · TypeScript · Vite · Tailwind · React Router |
| **AI** | Groq API (Llama 3.1 8B Instant), called per-message |
| **Deployment** | Render (backend) · Vercel (frontend) · Supabase (Postgres) |

---

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, SECRET_KEY, GROQ_API_KEY

# create the database first (createdb aicsmentor), then apply the migration:
alembic upgrade head

# seed the official BSc CS exit-exam curriculum (16 courses, real MoE codes/ECTS):
python -m scripts.seed_cs_exit_exam
python -m scripts.seed_sample_questions   # optional demo content

uvicorn app.main:app --reload