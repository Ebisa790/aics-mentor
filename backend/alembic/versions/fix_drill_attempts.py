"""add drill_attempts table

Revision ID: fix_drill_attempts
Revises: fb8d25280727
Create Date: 2026-09-01

"""
from alembic import op
import sqlalchemy as sa

revision = 'fix_drill_attempts'
down_revision = 'fb8d25280727'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'drill_attempts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('subject_slug', sa.String(), nullable=False),
        sa.Column('drill_id', sa.UUID(), nullable=True),
        sa.Column('selected_option', sa.Integer(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_drill_attempts_student_id', 'drill_attempts', ['student_id'])
    op.create_index('ix_drill_attempts_drill_id', 'drill_attempts', ['drill_id'])


def downgrade():
    op.drop_index('ix_drill_attempts_drill_id', table_name='drill_attempts')
    op.drop_index('ix_drill_attempts_student_id', table_name='drill_attempts')
    op.drop_table('drill_attempts')
