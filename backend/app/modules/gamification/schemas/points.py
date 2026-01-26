"""Points schemas for gamification"""

from pydantic import BaseModel
from datetime import datetime


class PointsResponse(BaseModel):
    """Saldo de pontos"""
    current_points: int
    lifetime_points: int


class PointsTransactionResponse(BaseModel):
    """Transação de pontos"""
    id: int
    amount: int
    balance_after: int
    reason: str
    reference_type: str | None
    reference_id: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class PointsHistoryResponse(BaseModel):
    """Histórico de pontos"""
    transactions: list[PointsTransactionResponse]
    current_balance: int
    lifetime_total: int
