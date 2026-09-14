"""add deleted_payments_log table

Revision ID: del01_deleted_payments
Revises: audit01_manual_audit
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'del01_deleted_payments'
down_revision = 'audit01_manual_audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'deleted_payments_log',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'payment_id',
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="The original payment id — not a FK since the row is gone.",
        ),
        sa.Column(
            'deleted_by',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='RESTRICT'),
            nullable=False,
            comment="The admin who deleted this payment.",
        ),
        sa.Column(
            'deleted_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'reason',
            sa.Text(),
            nullable=True,
            comment="Optional admin note explaining the deletion.",
        ),
        sa.Column(
            'payment_snapshot',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment="The full payment row as it existed before deletion.",
        ),
        sa.Column(
            'subscription_snapshot',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="The subscription row, if one existed.",
        ),
        sa.Column(
            'manual_detail_snapshot',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="The manual_payment_details row, if one existed.",
        ),
    )

    op.create_index(
        'ix_deleted_payments_log_payment_id',
        'deleted_payments_log',
        ['payment_id'],
        unique=False,
    )
    op.create_index(
        'ix_deleted_payments_log_deleted_at',
        'deleted_payments_log',
        ['deleted_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_deleted_payments_log_deleted_at', table_name='deleted_payments_log')
    op.drop_index('ix_deleted_payments_log_payment_id', table_name='deleted_payments_log')
    op.drop_table('deleted_payments_log')