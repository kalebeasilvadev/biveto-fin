from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.receipt import ReceiptStatus


class ReceiptPaymentCreate(BaseModel):
    """Pagamento individual do receipt"""
    payment_method: str
    amount: Decimal = Field(gt=0)
    account_id: int
    benefit_card_id: int | None = None
    original_label: str | None = None


class ReceiptItemCreate(BaseModel):
    """Item a ser convertido em Transaction"""
    description: str
    amount: Decimal = Field(gt=0)
    category_id: int | None = None
    quantity: float | None = None
    unit: str | None = None
    unit_price: Decimal | None = None


class ReceiptConfirmRequest(BaseModel):
    """Request para confirmar um receipt"""
    document_id: int

    # Dados do estabelecimento (extraídos ou editados)
    store_name: str
    store_cnpj: str | None = None
    purchase_date: date

    # Valores
    total_amount: Decimal
    subtotal: Decimal | None = None
    discount: Decimal | None = None

    # Itens selecionados
    items: list[ReceiptItemCreate]

    # Formas de pagamento com cartões vinculados
    payments: list[ReceiptPaymentCreate]

    # Categoria padrão para itens sem categoria
    default_category_id: int | None = None

    @model_validator(mode='after')
    def validate_payment_total(self):
        payment_total = sum(p.amount for p in self.payments)
        if abs(payment_total - self.total_amount) > Decimal('0.01'):
            raise ValueError(
                f'Soma dos pagamentos ({payment_total}) diferente do total ({self.total_amount})'
            )
        return self


class ReceiptPaymentResponse(BaseModel):
    """Resposta de um pagamento do receipt"""
    id: int
    payment_method: str
    amount: float
    account_id: int
    account_name: str | None = None
    benefit_card_id: int | None = None
    benefit_card_name: str | None = None
    sequence: int
    original_label: str | None = None

    class Config:
        from_attributes = True


class ReceiptResponse(BaseModel):
    """Resposta completa de um receipt"""
    id: int
    document_id: int | None
    store_name: str
    store_cnpj: str | None
    purchase_date: date
    total_amount: float
    subtotal: float | None
    discount: float | None
    status: str
    status_display: str
    created_at: datetime
    confirmed_at: datetime | None

    # Contadores
    items_count: int
    payments_count: int
    has_split_payment: bool

    # Relacionamentos (eager load)
    payments: list[ReceiptPaymentResponse] = []

    class Config:
        from_attributes = True


class ReceiptListResponse(BaseModel):
    """Resposta simplificada para listagem"""
    id: int
    document_id: int | None
    store_name: str
    purchase_date: date
    total_amount: float
    status: str
    status_display: str
    items_count: int
    payments_count: int
    has_split_payment: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReceiptUpdate(BaseModel):
    """Request para atualizar um receipt"""
    store_name: str | None = None
    store_cnpj: str | None = None
    purchase_date: date | None = None
    # Payments podem ser atualizados separadamente
