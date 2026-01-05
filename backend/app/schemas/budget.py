"""Schemas para Budget (Orçamento)"""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class BudgetItemBase(BaseModel):
    category_id: int
    planned_amount: Decimal = Field(..., ge=0)
    is_fixed: bool = False
    priority: int = 0
    notes: str | None = None


class BudgetItemCreate(BudgetItemBase):
    pass


class BudgetItemUpdate(BaseModel):
    planned_amount: Decimal | None = Field(None, ge=0)
    is_fixed: bool | None = None
    priority: int | None = None
    notes: str | None = None


class BudgetItemResponse(BudgetItemBase):
    id: int
    budget_id: int
    rollover_amount: Decimal
    created_at: datetime
    updated_at: datetime

    # Campos calculados (preenchidos pelo service)
    spent_amount: Decimal = Decimal(0)
    available_amount: Decimal = Decimal(0)
    percentage_used: float = 0.0
    category_name: str | None = None

    class Config:
        from_attributes = True


class BudgetBase(BaseModel):
    year: int = Field(..., ge=2020, le=2100)
    month: int = Field(..., ge=1, le=12)
    total_income_planned: Decimal = Field(default=Decimal(0), ge=0)
    allow_rollover: bool = True
    notes: str | None = None


class BudgetCreate(BudgetBase):
    items: list[BudgetItemCreate] = []


class BudgetUpdate(BaseModel):
    total_income_planned: Decimal | None = Field(None, ge=0)
    allow_rollover: bool | None = None
    notes: str | None = None


class BudgetResponse(BudgetBase):
    id: int
    user_id: int
    total_expense_planned: Decimal
    created_at: datetime
    updated_at: datetime
    items: list[BudgetItemResponse] = []

    # Campos calculados
    total_spent: Decimal = Decimal(0)
    total_available: Decimal = Decimal(0)
    total_income_actual: Decimal = Decimal(0)
    balance: Decimal = Decimal(0)
    health_score: float = 0.0  # 0-100, saúde do orçamento

    class Config:
        from_attributes = True


class BudgetSummary(BaseModel):
    """Resumo do orçamento para dashboard"""
    year: int
    month: int
    total_planned: Decimal
    total_spent: Decimal
    total_available: Decimal
    percentage_used: float
    days_remaining: int
    daily_budget_remaining: Decimal
    categories_over_budget: int
    categories_on_track: int


class BudgetCopyRequest(BaseModel):
    """Request para copiar orçamento de outro mês"""
    source_year: int
    source_month: int
    include_rollover: bool = True


class BudgetComparisonResponse(BaseModel):
    """Comparação entre orçamento planejado e realizado"""
    category_id: int
    category_name: str
    planned: Decimal
    actual: Decimal
    difference: Decimal
    percentage: float
    status: str  # "on_track", "over", "under"
