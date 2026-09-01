# AI-CS Mentor — Phase 1 MVP

AI Computer Science Exit Exam Mentor for Ethiopian BSc CS students. This scaffold covers
Phase 1 from the master spec: **auth, course system, notes upload, a basic AI tutor
(direct LLM calls — RAG comes in Phase 2), and quizzes with auto-grading and progress
tracking.**

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL + Alembic + JWT auth
- **Frontend:** React 18 + TypeScript + Vite + Tailwind + React Router
- **AI:** Anthropic API (Claude), called directly per-message for now; Phase 2 adds a
  vector DB (Chroma/Pinecone/Weaviate) and RAG over uploaded materials

## Project layout

```
backend/
  app/
    core/       # config, DB session, JWT + password hashing
    models/     # SQLAlchemy tables (see "Database schema" below)
    schemas/    # Pydantic request/response models
    api/routes/ # auth, users, courses, materials, quizzes, attempts, progress, tutor
  alembic/      # migrations (env.py already wired to the models)
frontend/
  src/
    api/        # axios client + typed endpoint functions
    context/    # AuthContext (JWT storage, current user)
    components/ # AppLayout, ProtectedRoute, MasteryRing, ExamCountdown
    pages/      # Login, Register, Dashboard, Courses, CourseDetail, Quiz, Tutor,
                #  Materials, Profile, Admin
```

## Database schema (Phase 1)

`departments` → `courses` (many-to-one; this is what makes adding a second degree
program later an admin action, not a code change)
`users` → `learning_materials`, `attempts`, `ai_conversations`, `student_progress`
`courses` → `topics` → `learning_materials`, `questions`
`quizzes` ↔ `questions` via `quiz_questions`
`attempts` → `attempt_answers` (grading + score lives on `attempts`)
`ai_conversations` → `ai_messages` (this *is* the tutor's memory — Phase 2 adds a
rolling summary back onto `users.strengths_summary` / `weaknesses_summary`)

Coding challenges and subscriptions (Phase 3 in the spec) aren't modeled yet — add them
as their own `models/` files + Alembic revision when you get there, rather than bolting
them onto existing tables.

### Curriculum data source

`scripts/seed_cs_exit_exam.py` loads the 16 official exit-exam courses for BSc
Computer Science straight from the Ministry of Education's published competency
guideline (Shumet Tadesse, University of Gondar, July 2022) — real course codes, ECTS
credits, and the six official exam themes, not placeholder data. One data-quality note
carried over from the source PDF: it lists the same code (`CoSc2041`) for both
"Fundamentals of Database Systems" and "Advanced Database Systems," which is almost
certainly a typo in the original document. Both are seeded as printed; the script's
docstring flags it so you can correct "Advanced Database Systems" once you confirm the
real code against your university's catalog.

### AI content QA workflow

`ExamQuestion` (admin panel, `/api/admin/courses/{id}/questions`) is a staging table,
not what students see — `Question` (the table quizzes/exams/the random exam generator
actually read from) is. The path from one to the other:

- **Human-authored** questions (`is_ai_generated: false`) are approved and promoted
  into `Question` immediately — an admin typing it directly *is* the review.
- **AI-drafted** questions (`is_ai_generated: true`) start at `GENERATED`, invisible to
  students. Editing one moves it to `UNDER_REVIEW`. `PATCH /api/admin/questions/{id}/review`
  with `{"action": "approve"}` promotes it into `Question` (rejection requires a
  `rejection_reason`; archiving retires old approved/rejected drafts without touching
  content already served to students).
- Approved questions can't be edited or deleted through the normal endpoints — archive
  and re-draft instead, so content a student may already have in their exam history
  never silently changes underneath them.
- `GET /api/admin/courses/{id}/questions?status=generated` doubles as the review queue.

Not tracked yet: source-document references in the audit trail (that needs the
RAG/document-ingestion module, which doesn't exist in this build) — today's AI drafts
are generated from a topic string, not retrieved course materials.

### Password reset

`POST /api/auth/forgot-password` always returns the same generic message regardless
of whether the email is registered (no user-enumeration leak). If it is registered, a
single-use, hashed, 30-minute token is created and — if `SMTP_HOST` is set in `.env` —
emailed via `app/core/email.py`. **No email provider is wired up in this build.**
Until you configure one:

- With no SMTP configured and `ENVIRONMENT` left at the default `development`, the raw
  reset token is logged server-side *and* returned directly in the API response
  (`dev_reset_token`), so the flow is fully testable without real email.
- Set `ENVIRONMENT=production` before deploying anywhere real — that field is hard-gated
  to never populate outside development, confirmed by test (see conversation history /
  test suite), not just "shouldn't happen in practice."
- `POST /api/auth/reset-password` invalidates *every* outstanding token for that user on
  a successful reset, not just the one that was used.

### Announcements

`GET /api/announcements` (any authenticated user) — pinned first, then newest first.
Feeds the dashboard. Writes (`POST`/`PUT`/`DELETE` under `/api/admin/announcements`)
are admin-only, managed from the `/admin` panel.

## Security posture

What's actually implemented and tested, not just aspirational:

- **Rate limiting** (`slowapi`, in-memory): login/register/reset-password at 15/min per
  IP, forgot-password at 10/min, AI endpoints (tutor chat, admin AI-draft) at 20–30/min
  — the AI limits are cost control as much as abuse prevention, since every call is a
  real Groq API charge. **In-memory storage does not share state across multiple
  worker processes or containers** — if you scale beyond one process, point
  `app/core/rate_limit.py` at Redis (`storage_uri="redis://..."`) or limits silently
  multiply per-process.
- **Production startup guards** (`main.py`, `_validate_production_config`): the app
  refuses to start with `ENVIRONMENT=production` if `SECRET_KEY` is still the dev
  default, `ALLOWED_HOSTS` is still `*`, or `FRONTEND_ORIGIN` still points at
  localhost. Turns a forgotten `.env` value into a startup crash instead of a live
  vulnerability.
- **Security headers** on every response (`X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy`, a restrictive
  `Permissions-Policy`). TLS termination itself is expected at a reverse proxy
  (Nginx/Caddy/load balancer) in front of this app — not implemented here, and
  shouldn't be.
- **File upload validation goes beyond the extension**: `app/api/routes/materials.py`
  checks actual file *content* signatures (PDF magic bytes, ZIP header for DOCX,
  null-byte/UTF-8 sanity check for TXT) — a renamed `.exe` claiming to be a `.pdf` is
  rejected. This is content-type validation, **not malware scanning** — a real
  virus-scan step (e.g. ClamAV) is separate, not-yet-built infrastructure.
- **Password complexity**: 8+ characters, at least one letter and one digit, on both
  registration and password reset. Deliberately not requiring symbols/mixed-case,
  which tends to produce predictable substitutions rather than real security gains.
- **No CSRF tokens** — this is a deliberate design choice, not an oversight. CSRF
  matters for cookie-based auth, where a browser attaches credentials automatically to
  cross-site requests. This API uses Bearer tokens the frontend attaches explicitly in
  an `Authorization` header, which a malicious site can't forge.
- **User-enumeration resistant**: `/api/auth/forgot-password` returns an identical
  response whether or not the email is registered.
- **SQL injection**: not applicable by construction — every query goes through
  SQLAlchemy's ORM/query builder, never raw string interpolation.

## Getting started

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, SECRET_KEY, GROQ_API_KEY

# create the database first (createdb aicsmentor), then apply the included migration:
alembic upgrade head

# seed the official BSc CS exit-exam curriculum (16 courses, real MoE codes/ECTS):
python -m scripts.seed_cs_exit_exam
python -m scripts.seed_sample_questions   # optional demo content for practice mode

uvicorn app.main:app --reload
```

The initial migration (`alembic/versions/50c4eec7beb3_initial_schema.py`, all 18
tables) is included and was generated *and applied* against a real PostgreSQL 16
instance, not just SQLite — the seed scripts and a full register → login → generate
exam → attempt → submit lifecycle were run against that same real database to confirm
it actually works end to end, not just that the model definitions look right. If you
add or change models going forward, generate the next migration the same way:
`alembic revision --autogenerate -m "description"`.

API docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL should point at the backend
npm run dev
```

App: `http://localhost:5173`

### First admin user

Registration always creates a `student`. Promote your first admin directly in the DB:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Then use `/admin` in the app (or the `/docs` Swagger UI) to create courses, topics,
questions, and quizzes.

## What's deliberately deferred to later phases

- **RAG / vector search** — materials are stored and status-tracked (`uploaded` →
  `embedded`) but not yet chunked/embedded. `MaterialStatus` and the `is_public` split
  between official vs. personal notes are already in place so Phase 2 just adds an
  ingestion worker.
- **Persistent AI memory beyond one conversation** — `users.strengths_summary` /
  `weaknesses_summary` exist as columns for the AI to write to, but nothing populates
  them yet. Natural Phase 2 addition: after each graded attempt or tutor exchange, run a
  small summarization call and update those fields.
- **Coding challenges, subscriptions, mobile** — Phase 3/4 per the spec; not modeled.

## Security notes carried over from the PhishGuard audit

This scaffold applies the same discipline as your PhishGuard fixes: uploaded files are
stored under a server-generated random filename (never the client-supplied name), file
type and size are validated before writing to disk, secrets live in `.env` (never
committed), and role checks happen server-side on every admin route — the frontend
hiding the `/admin` link is convenience, not enforcement.
