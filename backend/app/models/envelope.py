"""
Envelope Budgeting Model.

Implements YNAB-style envelope budgeting with daily/weekly/monthly limits,
rollover support, and spending tracking.
"""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlalchemy import String, ForeignKey, DateTime, Date, Numeric, Integer, Boolean, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from ..core.utils import utc_now


class EnvelopePeriodType(str, Enum):
    """Period type for envelope budget."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class EnvelopeStatus(str, Enum):
    """Status of envelope budget."""
    AVAILABLE = "available"  # Has funds remaining
    DEPLETED = "depleted"    # Reached zero
    OVERSPENT = "overspent"  # Exceeded budget


class EnvelopeRefillSchedule(str, Enum):
    """Refill schedule options."""
    WEEKLY_MONDAY = "weekly_monday"
    WEEKLY_SUNDAY = "weekly_sunday"
    BIWEEKLY_1ST_15TH = "biweekly_1st_15th"
    MONTHLY_1ST = "monthly_1st"
    MONTHLY_LAST = "monthly_last"
    CUSTOM = "custom"


class EnvelopeChangeType(str, Enum):
    """Type of change in envelope history."""
    REFILL = "refill"          # Periodic refill
    SPEND = "spend"            # Spending from envelope
    REFUND = "refund"          # Refund back to envelope
    ROLLOVER = "rollover"      # Rollover from previous period
    ADJUSTMENT = "adjustment"  # Manual adjustment
    TRANSFER = "transfer"      # Transfer between envelopes


class SpendingEnvelope(Base):
    """
    Spending envelope for category-based budgeting.

    Each envelope has a budget limit for a specific period (daily, weekly, monthly)
    and tracks spending against that limit.
    """
    __tablename__ = "spending_envelopes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )

    # Basic info
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)

    # Budget configuration
    period_type: Mapped[str] = mapped_column(String(20))  # EnvelopePeriodType
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    # Current state
    current_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    period_start_date: Mapped[date] = mapped_column(Date)
    period_end_date: Mapped[date] = mapped_column(Date)

    # Rollover settings
    allow_rollover: Mapped[bool] = mapped_column(Boolean, default=False)
    max_rollover_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    rollover_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    # Refill settings
    refill_schedule: Mapped[str] = mapped_column(
        String(30), default=EnvelopeRefillSchedule.MONTHLY_1ST.value
    )
    custom_refill_day: Mapped[int | None] = mapped_column(Integer)
    auto_refill: Mapped[bool] = mapped_column(Boolean, default=True)

    # Status and metadata
    status: Mapped[str] = mapped_column(
        String(20), default=EnvelopeStatus.AVAILABLE.value
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str | None] = mapped_column(String(20))
    icon: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    ownership_type: Mapped[str] = mapped_column(String(20), default="personal")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="spending_envelopes")
    category: Mapped["Category | None"] = relationship()
    history: Mapped[list["EnvelopeHistory"]] = relationship(
        back_populates="envelope",
        cascade="all, delete-orphan",
        lazy="noload"
    )

    __table_args__ = (
        Index('ix_envelopes_user_active', 'user_id', 'is_active'),
        Index('ix_envelopes_user_category', 'user_id', 'category_id'),
    )

    @property
    def spent_amount(self) -> Decimal:
        """Amount spent in current period."""
        return self.limit_amount - self.current_balance + self.rollover_balance

    @property
    def spent_percentage(self) -> float:
        """Percentage of budget spent."""
        if self.limit_amount <= 0:
            return 0.0
        return float((self.spent_amount / self.limit_amount) * 100)

    @property
    def remaining_days(self) -> int:
        """Days remaining in current period."""
        return max(0, (self.period_end_date - date.today()).days)

    @property
    def daily_allowance(self) -> Decimal:
        """Suggested daily spending based on remaining balance and days."""
        if self.remaining_days <= 0:
            return Decimal(0)
        return self.current_balance / self.remaining_days


class EnvelopeHistory(Base):
    """
    History of envelope changes.

    Tracks all changes to envelope balance for audit and analytics.
    """
    __tablename__ = "envelope_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    envelope_id: Mapped[int] = mapped_column(
        ForeignKey("spending_envelopes.id", ondelete="CASCADE"), index=True
    )
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"), index=True
    )

    # Change details
    change_type: Mapped[str] = mapped_column(String(20))  # EnvelopeChangeType
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    balance_before: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    # Period info
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)

    # Metadata
    notes: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Relationships
    envelope: Mapped["SpendingEnvelope"] = relationship(back_populates="history")
    transaction: Mapped["Transaction | None"] = relationship()

    __table_args__ = (
        Index('ix_envelope_history_envelope_date', 'envelope_id', 'created_at'),
    )


# Forward imports
from .user import User
from .category import Category
from .transaction import Transaction
