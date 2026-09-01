"""update payment models with subscription support

Revision ID: update_payment_001
Revises: ef21e39cd624
Create Date: 2026-08-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

revision = 'update_payment_001'
down_revision = 'ef21e39cd624'
branch_labels = None
depends_on = None


def _table_exists(table_name):
    conn = op.get_bind()
    inspector = inspect(conn)
    return table_name in inspector.get_table_names()


def _column_exists(table_name, column_name):
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c['name'] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # 1. Create pricing_plans if not exists
    if not _table_exists('pricing_plans'):
        op.create_table(
            'pricing_plans',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('name', sa.String(100), nullable=False, server_default='Lifetime Premium'),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('amount', sa.Numeric(10, 2), nullable=False, server_default='500.00'),
            sa.Column('currency', sa.String(10), nullable=False, server_default='ETB'),
            sa.Column('duration_type', sa.String(20), nullable=False, server_default='lifetime'),
            sa.Column('duration_value', sa.Integer(), nullable=True),
            sa.Column('features', sa.JSON(), nullable=False, server_default='[]'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.PrimaryKeyConstraint('id')
        )

    # 2. Create payments table if not exists
    if not _table_exists('payments'):
        op.create_table(
            'payments',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('plan_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('tx_ref', sa.String(255), nullable=False, unique=True),
            sa.Column('chapa_transaction_id', sa.String(255), nullable=True, unique=True),
            sa.Column('amount', sa.Numeric(10, 2), nullable=False),
            sa.Column('currency', sa.String(10), nullable=False, server_default='ETB'),
            sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
            sa.Column('checkout_url', sa.String(500), nullable=True),
            sa.Column('payment_method', sa.String(50), nullable=True),
            sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['plan_id'], ['pricing_plans.id'], ondelete='RESTRICT'),
            sa.PrimaryKeyConstraint('id')
        )
    else:
        # Add missing columns
        if not _column_exists('payments', 'plan_id'):
            op.add_column('payments', sa.Column('plan_id', postgresql.UUID(as_uuid=True), nullable=True))
        if not _column_exists('payments', 'chapa_transaction_id'):
            op.add_column('payments', sa.Column('chapa_transaction_id', sa.String(255), nullable=True))
        if not _column_exists('payments', 'payment_method'):
            op.add_column('payments', sa.Column('payment_method', sa.String(50), nullable=True))
        if not _column_exists('payments', 'verified_at'):
            op.add_column('payments', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))

    # 3. Create subscriptions table if not exists
    if not _table_exists('subscriptions'):
        op.create_table(
            'subscriptions',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('payment_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('plan_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='active'),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['plan_id'], ['pricing_plans.id'], ondelete='RESTRICT'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('payment_id')
        )

    # 4. Insert default pricing plan
    op.execute("""
        INSERT INTO pricing_plans (id, name, description, amount, currency, duration_type, features, is_active, is_archived, created_at, updated_at)
        SELECT gen_random_uuid(), 'Premium Lifetime', 'Full access to ExitAI Ethiopia - All courses, quizzes, mock exams, and AI features', 500.00, 'ETB', 'lifetime', '[]'::json, true, false, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM pricing_plans WHERE is_active = true AND is_archived = false)
    """)


def downgrade() -> None:
    if _table_exists('subscriptions'):
        op.drop_table('subscriptions')
    if _table_exists('payments'):
        op.drop_table('payments')
    if _table_exists('pricing_plans'):
        op.drop_table('pricing_plans')
