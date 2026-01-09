from datetime import datetime
from pydantic import BaseModel
from ..models.document import DocumentStatus, DocumentType


class ExtractedItemResponse(BaseModel):
    """Item individual extraído do documento"""
    description: str
    amount: float
    date: str | None  # YYYY-MM-DD
    category: str | None  # categoria sugerida pelo LLM
    confidence: float = 0.9

    # Informações de parcelamento
    is_installment: bool = False
    installment_current: int | None = None  # Parcela atual (ex: 3)
    installment_total: int | None = None    # Total de parcelas (ex: 12)

    class Config:
        from_attributes = True


class InstallmentAnalysisResponse(BaseModel):
    """Resultado da análise de parcela"""
    is_installment: bool
    series_found: dict | None = None
    series_status: dict | None = None
    installment_exists: bool = False
    suggestion: str | None = None  # create_single, create_series, add_to_series, mark_previous_paid, skip
    suggested_series: dict | None = None
    pending_installments: list[dict] | None = None


class DocumentExtractionResponse(BaseModel):
    """Extração salva no banco (para histórico)"""
    id: int
    version: int

    amount: float | None
    amount_confidence: float | None
    amount_source: str | None

    date: datetime | None
    date_confidence: float | None
    date_source: str | None

    merchant_name: str | None
    merchant_confidence: float | None
    merchant_cnpj: str | None

    items: dict | None
    payment_method: str | None
    installments: int | None
    suggested_category_id: int | None

    created_at: datetime

    class Config:
        from_attributes = True


class CardInfoResponse(BaseModel):
    """Informações do cartão extraídas de uma fatura"""
    card_issuer: str | None = None
    card_last_digits: str | None = None
    invoice_month: int | None = None
    invoice_year: int | None = None
    due_date: str | None = None
    total_amount: float | None = None


class DocumentResponse(BaseModel):
    id: int
    file_hash: str
    original_filename: str
    mime_type: str
    status: DocumentStatus
    document_type: DocumentType | None
    error_message: str | None
    created_at: datetime
    processed_at: datetime | None

    # Lista de itens extraídos (cada um é uma transação potencial)
    extracted_items: list[ExtractedItemResponse] = []

    # Alerta de duplicata (não bloqueia, apenas informa)
    is_duplicate: bool = False

    # Informações do cartão (apenas para fatura_cartao)
    card_info: CardInfoResponse | None = None

    class Config:
        from_attributes = True
