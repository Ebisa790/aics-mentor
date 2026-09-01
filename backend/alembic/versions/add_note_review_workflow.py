from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = 'add_note_review_workflow'
down_revision = '974a79ec9d92'  # Points to your current head
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns to course_notes table
    op.add_column('course_notes', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('course_notes', sa.Column('status', sa.String(20), nullable=False, server_default='DRAFT'))
    op.add_column('course_notes', sa.Column('reviewed_by_id', UUID(as_uuid=True), nullable=True))
    op.add_column('course_notes', sa.Column('reviewed_at', sa.DateTime(), nullable=True))
    op.add_column('course_notes', sa.Column('review_notes', sa.Text(), nullable=True))
    op.add_column('course_notes', sa.Column('updated_at', sa.DateTime(), nullable=True))

def downgrade():
    op.drop_column('course_notes', 'version')
    op.drop_column('course_notes', 'status')
    op.drop_column('course_notes', 'reviewed_by_id')
    op.drop_column('course_notes', 'reviewed_at')
    op.drop_column('course_notes', 'review_notes')
    op.drop_column('course_notes', 'updated_at')
