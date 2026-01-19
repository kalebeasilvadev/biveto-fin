"""
Schemas for Envelope Budgeting API.
"""

from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from typing import Literal

from app.models.envelope import EnvelopePeriodType, EnvelopeRefillSchedule


class EnvelopeCreate(BaseModel):
    """Schema for creating an envelope."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    category_id: int | None = None

    period_type: EnvelopePeriodType = EnvelopePeriodType.MONTHLY
    limit_amount: Decimal = Field(..., gt=0)

    allow_rollover: bool = False
    max_rollover_amount: Decimal | None = None

    refill_schedule: EnvelopeRefillSchedule = EnvelopeRefillSchedule.MONTHLY_1ST
    custom_refill_day: int | None = Field(None, ge=1, le=31)
    auto_refill: bool = True

    priority: int = 0
    color: str | None = None
    icon: str | None = None
    ownership_type: Literal["personal", "household"] = "personal"


class EnvelopeUpdate(BaseModel):
    """Schema for updating an envelope."""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    category_id: int | None = None

    period_type: EnvelopePeriodType | None = None
    limit_amount: Decimal | None = Field(None, gt=0)

    allow_rollover: bool | None = None
    max_rollover_amount: Decimal | None = None

    refill_schedule: EnvelopeRefillSchedule | None = None
    custom_refill_day: int | None = Field(None, ge=1, le=31)
    auto_refill: bool | None = None

    priority: int | None = None
    color: str | None = None
    icon: str | None = None
    is_active: bool | None = None


class EnvelopeResponse(BaseModel):
    """Response schema for envelope."""
    id: int
    name: str
    description: str | None
    category_id: int | None
    category_name: str | None = None

    period_type: str
    limit_amount: float
    current_balance: float

    period_start_date: date
    period_end_date: date

    allow_rollover: bool
    max_rollover_amount: float | None
    rollover_balance: float

    refill_schedule: str
    custom_refill_day: int | None
    auto_refill: bool

    status: str
    priority: int
    color: str | None
    icon: str | None
    is_active: bool
    ownership_type: str

    # Computed fields
    spent_amount: float
    spent_percentage: float
    remaining_days: int
    daily_allowance: float

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EnvelopeSummary(BaseModel):
    """Summary of all envelopes."""
    total_envelopes: int
    active_envelopes: int
    total_budgeted: float
    total_spent: float
    total_remaining: float
    overspent_count: int
    depleted_count: int


class DailyAllowance(BaseModel):
    """Daily spending allowance for an envelope."""
    envelope_id: int
    envelope_name: str
    current_balance: float
    remaining_days: int
    daily_allowance: float
    weekly_allowance: float
    period_end_date: date


class EnvelopeTransfer(BaseModel):
    """Schema for transferring between envelopes."""
    from_envelope_id: int
    to_envelope_id: int
    amount: Decimal = Field(..., gt=0)
    notes: str | None = None


class EnvelopeHistoryResponse(BaseModel):
    """Response schema for envelope history."""
    id: int
    envelope_id: int
    transaction_id: int | None
    change_type: str
    amount: float
    balance_before: float
    balance_after: float
    period_start: date
    period_end: date
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True
