"""add email verification

Revision ID: 440faec5b275
Revises: eb02_blueprint_details
Create Date: 2026-09-30 21:01:16.871212

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '440faec5b275'
down_revision: Union[str, None] = 'eb02_blueprint_details'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to users FIRST (so the grandfather UPDATE can use them)
    op.add_column(
        'users',
        sa.Column(
            'email_verified',
            sa.Boolean(),
            server_default='false',
            nullable=False,
        ),
    )
    op.add_column(
        'users',
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 2. Grandfather all existing users — they had accounts before verification existed
    op.execute("UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE")

    # 3. Create the verification tokens table
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_email_verification_tokens_token_hash'),
        'email_verification_tokens',
        ['token_hash'],
        unique=True,
    )
    op.create_index(
        op.f('ix_email_verification_tokens_user_id'),
        'email_verification_tokens',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_email_verification_tokens_user_id'),
        table_name='email_verification_tokens',
    )
    op.drop_index(
        op.f('ix_email_verification_tokens_token_hash'),
        table_name='email_verification_tokens',
    )
    op.drop_table('email_verification_tokens')
    op.drop_column('users', 'email_verified_at')
    op.drop_column('users', 'email_verified')