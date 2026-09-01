"""add performance indexes

Revision ID: add_indexes_001
Revises: update_payment_001
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_indexes_001'
down_revision = 'update_payment_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS to skip existing indexes
    op.execute('CREATE INDEX IF NOT EXISTS ix_questions_course_difficulty ON questions (course_id, difficulty)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_questions_course_type ON questions (course_id, question_type)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_attempts_user_submitted ON attempts (student_id, submitted_at)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_attempts_quiz_status ON attempts (quiz_id, status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_payments_user_status ON payments (user_id, status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_payments_tx_ref_status ON payments (tx_ref, status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_users_email_active ON users (email, is_active)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_users_subscription ON users (subscription_tier)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_quiz_questions_quiz_order ON quiz_questions (quiz_id, order_index)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_exam_questions_course_status ON exam_questions (course_id, review_status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_exam_questions_ai_generated ON exam_questions (is_ai_generated)')


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_questions_course_difficulty')
    op.execute('DROP INDEX IF EXISTS ix_questions_course_type')
    op.execute('DROP INDEX IF EXISTS ix_attempts_user_submitted')
    op.execute('DROP INDEX IF EXISTS ix_attempts_quiz_status')
    op.execute('DROP INDEX IF EXISTS ix_payments_user_status')
    op.execute('DROP INDEX IF EXISTS ix_payments_tx_ref_status')
    op.execute('DROP INDEX IF EXISTS ix_users_email_active')
    op.execute('DROP INDEX IF EXISTS ix_users_subscription')
    op.execute('DROP INDEX IF EXISTS ix_quiz_questions_quiz_order')
    op.execute('DROP INDEX IF EXISTS ix_exam_questions_course_status')
    op.execute('DROP INDEX IF EXISTS ix_exam_questions_ai_generated')
