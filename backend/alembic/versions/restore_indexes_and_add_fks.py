"""restore removed indexes and add missing foreign keys

Revision ID: restore_indexes_fks
Revises: c4163fa87117
Create Date: 2026-03-23

Restores composite indexes removed in ba9ea6b64409.
Adds missing FK constraints on DocumentExtraction.suggested_category_id
and Merchant.category_id.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'restore_indexes_fks'
down_revision: str = 'c4163fa87117'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ===== RESTORE INDEXES =====

    # CreditCardInvoice indexes (removed in ba9ea6b64409)
    op.create_index(
        'ix_invoices_user_status',
        'credit_card_invoices',
        ['user_id', 'status'],
    )
    op.create_index(
        'ix_invoices_card_period',
        'credit_card_invoices',
        ['credit_card_id', 'reference_year', 'reference_month'],
    )

    # Category indexes (removed in ba9ea6b64409)
    op.create_index(
        'ix_categories_user',
        'categories',
        ['user_id'],
    )
    op.create_index(
        'ix_categories_parent',
        'categories',
        ['parent_id'],
    )

    # Missing FK column indexes
    op.create_index(
        'ix_income_sources_category_id',
        'income_sources',
        ['category_id'],
    )
    op.create_index(
        'ix_installment_series_category_id',
        'installment_series',
        ['category_id'],
    )
    op.create_index(
        'ix_user_merchant_rules_category_id',
        'user_merchant_rules',
        ['category_id'],
    )
    op.create_index(
        'ix_transactions_credit_card_id',
        'transactions',
        ['credit_card_id'],
    )
    op.create_index(
        'ix_transactions_recurring_id',
        'transactions',
        ['recurring_id'],
    )

    # ===== ADD MISSING FOREIGN KEYS =====

    # DocumentExtraction.suggested_category_id → categories.id
    # First, clean orphaned references (set to NULL where category doesn't exist)
    op.execute(
        sa.text("""
            UPDATE document_extractions
            SET suggested_category_id = NULL
            WHERE suggested_category_id IS NOT NULL
            AND suggested_category_id NOT IN (SELECT id FROM categories)
        """)
    )
    op.create_foreign_key(
        'fk_document_extractions_category',
        'document_extractions',
        'categories',
        ['suggested_category_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_document_extractions_category_id',
        'document_extractions',
        ['suggested_category_id'],
    )

    # Merchant.category_id → categories.id
    # First, clean orphaned references
    op.execute(
        sa.text("""
            UPDATE merchants
            SET category_id = NULL
            WHERE category_id IS NOT NULL
            AND category_id NOT IN (SELECT id FROM categories)
        """)
    )
    op.create_foreign_key(
        'fk_merchants_category',
        'merchants',
        'categories',
        ['category_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_merchants_category_id',
        'merchants',
        ['category_id'],
    )


def downgrade() -> None:
    # Remove FKs
    op.drop_constraint('fk_merchants_category', 'merchants', type_='foreignkey')
    op.drop_index('ix_merchants_category_id', 'merchants')
    op.drop_constraint('fk_document_extractions_category', 'document_extractions', type_='foreignkey')
    op.drop_index('ix_document_extractions_category_id', 'document_extractions')

    # Remove restored indexes
    op.drop_index('ix_transactions_recurring_id', 'transactions')
    op.drop_index('ix_transactions_credit_card_id', 'transactions')
    op.drop_index('ix_user_merchant_rules_category_id', 'user_merchant_rules')
    op.drop_index('ix_installment_series_category_id', 'installment_series')
    op.drop_index('ix_income_sources_category_id', 'income_sources')
    op.drop_index('ix_categories_parent', 'categories')
    op.drop_index('ix_categories_user', 'categories')
    op.drop_index('ix_invoices_card_period', 'credit_card_invoices')
    op.drop_index('ix_invoices_user_status', 'credit_card_invoices')
