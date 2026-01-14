from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from app.models.household import OwnershipType
from app.models.transaction import PaymentMethod


class RecurrenceFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class RecurringStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class TransactionType(str, Enum):
    EXPENSE = "expense"
    INCOME = "income"


class RecurringCreate(BaseModel):
    """Schema para criar uma transacao recorrente"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    amount: float = Field(..., gt=0)
    type: TransactionType = TransactionType.EXPENSE
    payment_method: Optional[PaymentMethod] = None  # credit_card, pix, boleto, etc.
    account_id: int
    category_id: Optional[int] = None
    frequency: RecurrenceFrequency
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_date: date
    end_date: Optional[date] = None
    ownership_type: OwnershipType = OwnershipType.PERSONAL


class RecurringUpdate(BaseModel):
    """Schema para atualizar uma transação recorrente"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[TransactionType] = None
    payment_method: Optional[PaymentMethod] = None
    account_id: Optional[int] = None
    category_id: Optional[int] = None
    frequency: Optional[RecurrenceFrequency] = None
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    end_date: Optional[date] = None
    status: Optional[RecurringStatus] = None


class RecurringResponse(BaseModel):
    """Schema de resposta de uma transacao recorrente"""
    id: int
    name: str
    description: Optional[str]
    amount: float
    type: str
    payment_method: Optional[str] = None
    account_id: int
    account_name: Optional[str] = None
    category_id: Optional[int]
    category_name: Optional[str] = None
    frequency: str
    day_of_month: Optional[int]
    day_of_week: Optional[int]
    start_date: date
    end_date: Optional[date]
    status: str
    ownership_type: str = "personal"
    last_generated_date: Optional[date]
    next_due_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecurringSummary(BaseModel):
    """Resumo das transações recorrentes"""
    total_monthly_expenses: float
    total_monthly_income: float
    active_count: int
    paused_count: int


class RecurringFromSuggestionCreate(BaseModel):
    """Schema para criar recorrência a partir de sugestão detectada"""
    # Campos obrigatórios
    name: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    account_id: int

    # Campos da sugestão (opcionais com defaults)
    frequency: RecurrenceFrequency = RecurrenceFrequency.MONTHLY
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    category_id: Optional[int] = None
    category_name: Optional[str] = None  # Alternativa ao category_id - busca por nome

    # Campos extras
    description: Optional[str] = Field(None, max_length=500)
    start_date: Optional[date] = None  # Se não informado, usa hoje
    payment_method: Optional[PaymentMethod] = PaymentMethod.CREDIT_CARD
    type: TransactionType = TransactionType.EXPENSE
    known_service_id: Optional[int] = None  # ID do serviço conhecido (opcional, para tracking)
    credit_card_id: Optional[int] = None  # ID do cartão de crédito (para faturas)


# ============================================
# Schemas para Batch Create from Suggestion
# ============================================

class BatchRecurringFromSuggestionRequest(BaseModel):
    """Request para criar múltiplas recorrências de uma vez"""
    items: list[RecurringFromSuggestionCreate] = Field(min_length=1, max_length=50)


class BatchRecurringItemResult(BaseModel):
    """Resultado de um item do batch"""
    index: int
    success: bool
    recurring_id: Optional[int] = None
    recurring_name: Optional[str] = None
    error: Optional[str] = None
    is_duplicate: bool = False


class BatchRecurringResponse(BaseModel):
    """Resposta do batch create"""
    total: int
    success_count: int
    duplicate_count: int
    error_count: int
    results: list[BatchRecurringItemResult]
