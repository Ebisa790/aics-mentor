"""add manual_audit_log column to payments

Revision ID: audit01_manual_audit
Revises: manual01_manual_payments
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'audit01_manual_audit'
down_revision = 'manual01_manual_payments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable JSONB — Chapa payments never touch this column.
    op.add_column(
        'payments',
        sa.Column(
            'manual_audit_log',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('payments', 'manual_audit_log')