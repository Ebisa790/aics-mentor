"""add general_objective and learning_outcomes to exam_blueprint_items

Revision ID: eb02_blueprint_details
Revises: eb01_exam_blueprint
Create Date: 2026-09-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eb02_blueprint_details'
down_revision = 'eb01_exam_blueprint'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'exam_blueprint_items',
        sa.Column('general_objective', sa.Text(), nullable=True),
    )
    op.add_column(
        'exam_blueprint_items',
        sa.Column('learning_outcomes', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('exam_blueprint_items', 'learning_outcomes')
    op.drop_column('exam_blueprint_items', 'general_objective')
