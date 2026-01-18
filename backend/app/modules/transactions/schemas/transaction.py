from datetime import datetime, date as date_type
from pydantic import BaseModel, Field
from app.models.transaction import TransactionType, PaymentMethod
from app.models.household import OwnershipType


class TransactionBase(BaseModel):
    type: TransactionType
    payment_method: PaymentMethod | None = None
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
    ownership_type: OwnershipType = OwnershipType.PERSONAL
    credit_card_id: int | None = None  # For credit card expenses
    income_source_id: int | None = None  # For income transactions

    # Transfer support - destination account for transfers between accounts
    destination_account_id: int | None = None  # Required when type=transfer

    # Campos para criar recorrencia junto com a transacao
    create_recurring: bool = False
    recurring_frequency: str | None = None  # 'daily', 'weekly', 'monthly', 'yearly'
    recurring_day_of_month: int | None = None  # Para frequencia mensal
    recurring_day_of_week: int | None = None  # Para frequencia semanal (0-6)


class TransactionConfirm(BaseModel):
    """Confirmacao de transacao a partir de documento processado"""
    document_id: int | None = None  # Opcional para transacoes sem documento
    account_id: int
    amount: float = Field(gt=0)
    date: date_type
    category_id: int | None = None
    merchant_name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    is_fixed: bool = False
    ownership_type: OwnershipType = OwnershipType.PERSONAL
    payment_method: PaymentMethod | None = None  # Metodo de pagamento
    credit_card_id: int | None = None  # For credit card expenses
    income_source_id: int | None = None  # For income transactions

    # Tipo de transacao extraido do documento (LLM)
    # Valores: compra, estorno, credito, pagamento, anuidade, encargo, saldo_anterior
    # Usado para determinar se e expense ou income
    extracted_transaction_type: str | None = None

    # Campos de fatura (quando vem de PDF de fatura)
    invoice_month: int | None = None  # Mes de referencia da fatura (1-12)
    invoice_year: int | None = None   # Ano de referencia da fatura

    # Campos de parcelamento
    is_installment: bool = False
    installment_current: int | None = None
    installment_total: int | None = None
    installment_series_id: int | None = None  # Vincular a serie existente
    mark_previous_as_paid: bool = False  # Marcar parcelas anteriores como pagas
    create_future_installments: bool = False  # Criar parcelas futuras

    # Forcar salvamento mesmo se detectar duplicado
    force_duplicate: bool = False


class TransactionUpdate(BaseModel):
    amount: float | None = Field(None, gt=0)
    date: date_type | None = None
    type: TransactionType | None = None
    payment_method: PaymentMethod | None = None
    account_id: int | None = None
    category_id: int | None = None
    merchant_name: str | None = None
    description: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    is_fixed: bool | None = None
    is_paid: bool | None = None
    invoice_id: int | None = None  # Para mover transacao entre faturas


class TransactionResponse(TransactionBase):
    id: int
    account_id: int
    category_id: int | None
    merchant_id: int | None
    document_id: int | None
    credit_card_id: int | None = None
    invoice_id: int | None = None
    income_source_id: int | None = None
    is_recurring: bool
    is_paid: bool = True
    installment_series_id: int | None = None
    installment_number: int | None
    installment_total: int | None
    ownership_type: str = "personal"
    created_at: datetime
    updated_at: datetime

    # Transfer support
    linked_transaction_id: int | None = None
    is_transfer_out: bool = False  # True se é a saída de uma transferência
    is_transfer_in: bool = False   # True se é a entrada de uma transferência

    # Dados relacionados
    category_name: str | None = None
    account_name: str | None = None
    merchant_name: str | None = None
    credit_card_name: str | None = None
    income_source_name: str | None = None
    invoice_display: str | None = None  # Ex: "Jan/2026"
    payment_method_display: str | None = None  # Ex: "Cartao de Credito"
    signed_amount: float | None = None  # Valor com sinal (negativo para despesas)

    # Transfer related account name (for display purposes)
    linked_account_name: str | None = None  # Nome da conta de destino/origem da transferência

    # Indicador de parcelamento
    @property
    def is_installment(self) -> bool:
        return self.installment_number is not None and self.installment_total is not None

    class Config:
        from_attributes = True


# ============================================
# Schemas para Batch Confirm
# ============================================

class BatchConfirmItem(BaseModel):
    """Item individual do batch confirm - mesmo schema do TransactionConfirm"""
    document_id: int | None = None
    account_id: int
    amount: float = Field(gt=0)
    date: date_type
    category_id: int | None = None
    merchant_name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    is_fixed: bool = False
    ownership_type: OwnershipType = OwnershipType.PERSONAL
    payment_method: PaymentMethod | None = None
    credit_card_id: int | None = None
    income_source_id: int | None = None
    extracted_transaction_type: str | None = None  # Tipo extraido do LLM
    invoice_month: int | None = None
    invoice_year: int | None = None
    is_installment: bool = False
    installment_current: int | None = None
    installment_total: int | None = None
    installment_series_id: int | None = None
    mark_previous_as_paid: bool = False
    create_future_installments: bool = False
    force_duplicate: bool = False


class BatchConfirmRequest(BaseModel):
    """Request para confirmar múltiplas transações de uma vez"""
    items: list[BatchConfirmItem] = Field(min_length=1, max_length=100)

    # Informacoes do cartao extraidas do PDF (para atualizar o cartao automaticamente)
    card_closing_day: int | None = None  # Dia de fechamento extraido do PDF (1-31)
    card_due_day: int | None = None  # Dia de vencimento extraido do PDF (1-31)


class BatchConfirmItemResult(BaseModel):
    """Resultado de um item do batch"""
    index: int
    success: bool
    transaction_id: int | None = None
    error: str | None = None
    is_duplicate: bool = False


class BatchConfirmResponse(BaseModel):
    """Resposta do batch confirm"""
    total: int
    success_count: int
    duplicate_count: int
    error_count: int
    results: list[BatchConfirmItemResult]
