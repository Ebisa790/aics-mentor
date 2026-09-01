"""create user_devices table

Revision ID: 3a76ca287e25
Revises: accb9ea72835
Create Date: 2026-07-30 22:31:28.383852

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3a76ca287e25'
down_revision: Union[str, None] = 'accb9ea72835'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Keep ONLY the user_devices table creation
    op.create_table(
        'user_devices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('session_jti', sa.String(length=255), nullable=False),
        sa.Column('device_name', sa.String(length=100), nullable=False),
        sa.Column('device_type', sa.String(length=20), nullable=False),
        sa.Column('browser', sa.String(length=100), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('last_active', sa.DateTime(), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_devices_session_jti'), 'user_devices', ['session_jti'], unique=False)
    op.create_index(op.f('ix_user_devices_user_id'), 'user_devices', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_devices_user_id'), table_name='user_devices')
    op.drop_index(op.f('ix_user_devices_session_jti'), table_name='user_devices')
    op.drop_table('user_devices')