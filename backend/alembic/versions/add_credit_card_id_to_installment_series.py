"""Add credit_card_id to installment_series

Revision ID: add_cc_installment
Revises: add_credit_card_invoices
Create Date: 2026-01-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_cc_installment'
down_revision: Union[str, None] = None  # Will be set after running
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add credit_card_id column to installment_series
    op.add_column(
        'installment_series',
        sa.Column('credit_card_id', sa.Integer(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_installment_series_credit_card',
        'installment_series',
        'credit_cards',
        ['credit_card_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Add index for better query performance
    op.create_index(
        'ix_installment_series_credit_card_id',
        'installment_series',
        ['credit_card_id']
    )


def downgrade() -> None:
    op.drop_index('ix_installment_series_credit_card_id', 'installment_series')
    op.drop_constraint('fk_installment_series_credit_card', 'installment_series', type_='foreignkey')
    op.drop_column('installment_series', 'credit_card_id')
