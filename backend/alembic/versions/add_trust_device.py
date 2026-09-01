"""add trust device fields

Revision ID: add_trust_device
Revises: add_indexes_001
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_trust_device'
down_revision = 'add_indexes_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT FALSE NOT NULL')
    op.execute('ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS trusted_until TIMESTAMP WITH TIME ZONE')


def downgrade() -> None:
    op.execute('ALTER TABLE user_devices DROP COLUMN IF EXISTS is_trusted')
    op.execute('ALTER TABLE user_devices DROP COLUMN IF EXISTS trusted_until')
