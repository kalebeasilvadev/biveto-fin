"""add reset_token_expires to users

Revision ID: add_token_expires
Revises: 637898c1dca0
Create Date: 2026-01-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_token_expires'
down_revision: Union[str, None] = '637898c1dca0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adicionar coluna reset_token_expires para expiração do token de reset de senha
    op.add_column('users', sa.Column('reset_token_expires', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'reset_token_expires')
