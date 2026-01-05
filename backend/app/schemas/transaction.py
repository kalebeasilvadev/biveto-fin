from datetime import datetime, date as date_type
from pydantic import BaseModel, Field
from ..models.transaction import TransactionType


class TransactionBase(BaseModel):
    type: TransactionType
    amount: float = Field(gt=0)
    currency: str = "BRL"
    date: date_type
    description: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    is_fixed: bool = False


class TransactionCreate(TransactionBase):
    account_id: int
    category_id: int | None = None
    merchant_name: str | None = None


class TransactionConfirm(BaseModel):
    """Confirmação de transação a partir de documento processado"""
    document_id: int | None = None  # Opcional para transações sem documento
    account_id: int
    amount: float = Field(gt=0)
    date: date_type
    category_id: int | None = None
    merchant_name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    is_fixed: bool = False

    # Campos de parcelamento
    is_installment: bool = False
    installment_current: int | None = None
    installment_total: int | None = None
    installment_series_id: int | None = None  # Vincular a série existente
    mark_previous_as_paid: bool = False  # Marcar parcelas anteriores como pagas
    create_future_installments: bool = False  # Criar parcelas futuras


class TransactionUpdate(BaseModel):
    amount: float | None = Field(None, gt=0)
    date: date_type | None = None
    category_id: int | None = None
    description: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    is_fixed: bool | None = None


class TransactionResponse(TransactionBase):
    id: int
    account_id: int
    category_id: int | None
    merchant_id: int | None
    document_id: int | None
    is_recurring: bool
    is_paid: bool = True
    installment_series_id: int | None = None
    installment_number: int | None
    installment_total: int | None
    created_at: datetime
    updated_at: datetime

    # Dados relacionados
    category_name: str | None = None
    account_name: str | None = None
    merchant_name: str | None = None

    # Indicador de parcelamento
    @property
    def is_installment(self) -> bool:
        return self.installment_number is not None and self.installment_total is not None

    class Config:
        from_attributes = True
