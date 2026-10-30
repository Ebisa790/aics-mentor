# AI-CS Mentor

A web-based preparation platform for the Ethiopian BSc Computer Science Exit
Examination. Students study curriculum-aligned material, take computer-based mock
exams modeled on the official exam blueprint, and get AI-assisted explanations of
concepts and wrong answers.

**Live demo:** [add your Vercel URL here]
**API docs:** [add your Render URL + /docs here - only works in non-production]

---

## What it does

The Ethiopian National Exit Exam covers 16 Computer Science courses across six exam
themes. Students preparing for it typically rely on scattered PDFs, disconnected
practice questions, and generic AI chatbots that don't know the curriculum.

This platform pulls all of that into one place:

- **Curriculum-aligned content** - courses, topics, notes, and questions seeded from
  the Ministry of Education's published competency guideline (16 courses, real course
  codes, ECTS credits, official exam themes).
- **Mock exams** - timed, full-screen, blueprint-aligned exams that match the real
  format. Auto-graded with per-topic breakdown.
- **AI tutor** - a chat-based assistant for concept explanations and wrong-answer
  review. Currently uses direct LLM calls; RAG over the question bank is on the
  roadmap.
- **Progress tracking** - per-course mastery, attempt history, and weak-area
  identification.

---

## Tech Stack

| Layer | Stack |
|---|---|
| **Backend** | FastAPI + SQLAlchemy 2.0 + PostgreSQL + Alembic + JWT auth |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind + React Router |
| **AI** | Groq API (Llama 3.1 8B Instant), called per-message |
| **Deployment** | Render (backend) + Vercel (frontend) + Supabase (Postgres) |

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
```

API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL should point at the backend
npm run dev
```

App at `http://localhost:5173`.

### First admin user

Registration always creates a `student`. Promote your first admin directly in the DB:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Then visit `/admin` in the app (or use `/docs`) to create courses, topics, questions,
and quizzes.

---

## How it works

### Curriculum data source

`scripts/seed_cs_exit_exam.py` loads the 16 official exit-exam courses for BSc
Computer Science from the Ministry of Education's competency guideline (Shumet
Tadesse, University of Gondar, July 2022) - real course codes, ECTS credits, and
the six official exam themes.

One data-quality note from the source PDF: it lists the same code (`CoSc2041`) for
both "Fundamentals of Database Systems" and "Advanced Database Systems." This is
likely a typo in the original. Both are seeded as printed, and the script's docstring
flags it so you can correct it against your university's catalog.

### AI content QA workflow

`ExamQuestion` (admin-facing) is a staging table. `Question` (student-facing) is what
quizzes and exams actually read from. The path from one to the other:

- **Human-authored** questions are promoted to `Question` immediately - an admin
  typing it is the review.
- **AI-drafted** questions start at `GENERATED`, invisible to students. Editing moves
  them to `UNDER_REVIEW`. `PATCH /api/admin/questions/{id}/review` with
  `{"action": "approve"}` promotes them to `Question`. Rejection requires a
  `rejection_reason`.
- **Approved** questions can't be edited or deleted through normal endpoints -
  archive and re-draft instead, so exam content a student may already have answered
  never changes underneath them.
- `GET /api/admin/courses/{id}/questions?status=generated` doubles as the review queue.

Today's AI drafts are generated from a topic string. Source-document references in
the audit trail require the RAG module, which is on the roadmap.

### Password reset

`POST /api/auth/forgot-password` returns the same generic message whether or not the
email is registered (no enumeration leak). If it is registered, a single-use, hashed,
30-minute token is created and - if `SMTP_HOST` is set - emailed via
`app/core/email.py`.

**No email provider is wired up in this build.** In development, the raw reset token
is logged server-side and returned as `dev_reset_token` in the API response so the
flow is fully testable without SMTP. In production (`ENVIRONMENT=production`), that
field is hard-gated to never populate - enforced by automated test, not convention.

`POST /api/auth/reset-password` invalidates every outstanding token for that user on
a successful reset, not just the one used.

### Announcements

`GET /api/announcements` (any authenticated user) - pinned first, then newest first.
Feeds the dashboard. Writes (`POST`/`PUT`/`DELETE` under `/api/admin/announcements`)
are admin-only, managed from the `/admin` panel.

---

## Security

- **Rate limiting** (`slowapi`, in-memory): login/register/reset-password at 15/min
  per IP, forgot-password at 10/min, AI endpoints at 20-30/min (cost control as much
  as abuse prevention). In-memory storage doesn't share state across worker
  processes - for multi-process deployment, point `app/core/rate_limit.py` at Redis.
- **Production startup guards** (`main.py` -> `_validate_production_config`): the app
  refuses to start with `ENVIRONMENT=production` if `SECRET_KEY` is still the dev
  default, `ALLOWED_HOSTS` is still `*`, or `FRONTEND_ORIGIN` still points at
  localhost. A forgotten `.env` value becomes a startup crash, not a live
  vulnerability.
- **Security headers** on every response: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy`, restrictive
  `Permissions-Policy`. TLS termination is expected at a reverse proxy in front of
  the app.
- **File upload validation** by content signature, not extension. PDF magic bytes,
  ZIP header for DOCX, null-byte/UTF-8 check for TXT - a renamed `.exe` claiming to
  be `.pdf` is rejected. This is content-type validation, not malware scanning.
  Malware scanning (e.g. ClamAV) is separate, not-yet-built infrastructure.
- **Password complexity**: 8+ characters, at least one letter and one digit.
- **No CSRF tokens** - deliberate. This API uses Bearer tokens attached explicitly
  in the `Authorization` header, not cookie-based auth, so CSRF doesn't apply.
- **User-enumeration resistant**: forgot-password responses are identical regardless
  of whether the email is registered.
- **SQL injection**: not applicable by construction - all queries go through
  SQLAlchemy's ORM, never raw string interpolation.
- **File storage**: uploads use server-generated random filenames (never
  client-supplied). File type and size are validated before writing to disk. Secrets
  live in `.env`, never committed. Role checks happen server-side on every admin
  route - the frontend hiding the `/admin` link is convenience, not enforcement.

---

## Roadmap

What's deliberately deferred to later phases:

- **RAG / vector search** - materials are stored and status-tracked
  (`uploaded` -> `embedded`) but not yet chunked or embedded. The `MaterialStatus`
  enum and the `is_public` split (official vs. personal notes) are already in place,
  so adding retrieval is a matter of wiring up an ingestion worker.
- **Persistent AI memory** - `users.strengths_summary` / `weaknesses_summary` exist
  as columns for the AI to write to, but nothing populates them yet. The natural
  addition is a post-attempt or post-tutor summarization call.
- **Adaptive question selection** - knowledge-tracing model to estimate per-topic
  mastery and drive question selection from it. Currently the mock exam is
  blueprint-fixed.
- **Coding challenges, subscriptions, mobile app** - later phases; not modeled.

---

## License

Add a license here - MIT and Apache 2.0 are the common choices for portfolio
projects. If unsure, MIT.