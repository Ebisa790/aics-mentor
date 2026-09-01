"""add drill_id and selected_option to drill_attempts

Revision ID: accb9ea72835
Revises: ce57bdfb8fdb
Create Date: 2026-07-30 17:45:26.634801

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'accb9ea72835'
down_revision: Union[str, None] = 'ce57bdfb8fdb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create drill_attempts table if it doesn't exist
    op.create_table(
        'drill_attempts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('subject_slug', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # Add missing columns to drill_attempts table
    op.add_column('drill_attempts', sa.Column('drill_id', sa.String(), nullable=True))
    op.add_column('drill_attempts', sa.Column('selected_option', sa.Integer(), nullable=True))
    op.add_column('drill_attempts', sa.Column('is_correct', sa.Boolean(), nullable=True))


def downgrade() -> None:
    # Drop the table entirely
    op.drop_table('drill_attempts')