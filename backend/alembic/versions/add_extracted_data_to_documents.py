"""add extracted_data to documents

Revision ID: add_extracted_data
Revises: add_receipts
Create Date: 2025-01-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_extracted_data'
down_revision: Union[str, None] = 'add_receipts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add extracted_data column if it doesn't exist
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'documents' AND column_name = 'extracted_data'
            ) THEN
                ALTER TABLE documents ADD COLUMN extracted_data JSONB;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_column('documents', 'extracted_data')
