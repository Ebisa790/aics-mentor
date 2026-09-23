"""add exam_blueprint_items table

Revision ID: eb01_exam_blueprint
Revises: del01_deleted_payments
Create Date: 2026-09-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'eb01_exam_blueprint'
down_revision = 'del01_deleted_payments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'exam_blueprint_items',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column('theme', sa.String(length=100), nullable=False),
        sa.Column('course_name', sa.String(length=200), nullable=False),
        sa.Column('credit_hours', sa.Integer(), nullable=False),
        sa.Column('test_items', sa.Integer(), nullable=False),
        sa.Column('cognitive_remember', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cognitive_understand', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cognitive_apply', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cognitive_analyze', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cognitive_evaluate', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cognitive_create', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )

    op.create_index(
        'ix_exam_blueprint_items_theme',
        'exam_blueprint_items',
        ['theme'],
        unique=False,
    )
    op.create_index(
        'ix_exam_blueprint_items_course_id',
        'exam_blueprint_items',
        ['course_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_exam_blueprint_items_course_id', table_name='exam_blueprint_items')
    op.drop_index('ix_exam_blueprint_items_theme', table_name='exam_blueprint_items')
    op.drop_table('exam_blueprint_items')
