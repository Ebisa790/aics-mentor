"""add manual_payment_details table

Revision ID: manual01_manual_payments
Revises: fix_drill_attempts
Create Date: 2026-09-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'manual01_manual_payments'
down_revision = 'fix_drill_attempts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'manual_payment_details',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'payment_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('payments.id', ondelete='CASCADE'),
            nullable=False,
            unique=True,
        ),
        sa.Column('bank_name', sa.String(length=50), nullable=False),
        sa.Column('bank_reference', sa.String(length=255), nullable=False, unique=True),
        sa.Column('sender_name', sa.String(length=255), nullable=True),
        sa.Column('sender_phone', sa.String(length=20), nullable=True),
        sa.Column('student_note', sa.Text(), nullable=True),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )

    op.create_index(
        'ix_manual_payment_details_bank_name',
        'manual_payment_details',
        ['bank_name'],
        unique=False,
    )
    op.create_index(
        'ix_manual_payment_details_created_at',
        'manual_payment_details',
        ['created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_manual_payment_details_created_at', table_name='manual_payment_details')
    op.drop_index('ix_manual_payment_details_bank_name', table_name='manual_payment_details')
    op.drop_table('manual_payment_details')
