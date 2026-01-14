"""Debts module - Debt management"""
from app.modules.debts.routers.debts import router
from app.modules.debts.services.debt_service import DebtService
from app.modules.debts.schemas.debt import (
    DebtCreate,
    DebtUpdate,
    DebtPaymentCreate,
    DebtResponse,
    DebtDetailResponse,
    DebtPaymentResponse,
    DebtPayoffProjection,
    DebtSummary,
    DebtHighlight,
    SnowballPlan,
    AvalanchePlan,
    SnowballDebtStep,
    PayoffStrategyComparison,
)

__all__ = [
    "router",
    "DebtService",
    "DebtCreate",
    "DebtUpdate",
    "DebtPaymentCreate",
    "DebtResponse",
    "DebtDetailResponse",
    "DebtPaymentResponse",
    "DebtPayoffProjection",
    "DebtSummary",
    "DebtHighlight",
    "SnowballPlan",
    "AvalanchePlan",
    "SnowballDebtStep",
    "PayoffStrategyComparison",
]
