from datetime import datetime
from pydantic import BaseModel
from app.models.document import DocumentStatus, DocumentType
from app.modules.known_services.schemas.recurring_detection import RecurringDetection


class FutureInstallmentResponse(BaseModel):
    """Parcela futura calculada pelo LLM"""
    installment: int  # Numero da parcela (ex: 4)
    reference_month: int  # Mes de referencia (1-12)
    reference_year: int  # Ano de referencia


class ExtractedItemResponse(BaseModel):
    """Item individual extraido do documento"""
    description: str
    amount: float
    date: str | None  # YYYY-MM-DD
    category: str | None  # categoria sugerida pelo LLM
    confidence: float = 0.9

    # Tipo de transacao extraido pelo LLM
    # Valores: compra, estorno, credito, pagamento, anuidade, encargo, saldo_anterior
    transaction_type: str | None = None

    # Informacoes de parcelamento
    is_installment: bool = False
    installment_current: int | None = None  # Parcela atual (ex: 3)
    installment_total: int | None = None    # Total de parcelas (ex: 12)

    # Parcelas futuras calculadas pelo LLM (para Santander/Itau que mostram todas as parcelas)
    future_installments: list[FutureInstallmentResponse] | None = None

    # Flag de duplicado (ja existe transacao similar no banco)
    is_duplicate: bool = False
    existing_transaction_id: int | None = None

    # Deteccao de recorrencia (Netflix, Spotify, etc.)
    recurring_detection: RecurringDetection | None = None

    class Config:
        from_attributes = True


class InstallmentAnalysisResponse(BaseModel):
    """Resultado da analise de parcela"""
    is_installment: bool
    series_found: dict | None = None
    series_status: dict | None = None
    installment_exists: bool = False
    suggestion: str | None = None  # create_single, create_series, add_to_series, mark_previous_paid, skip
    suggested_series: dict | None = None
    pending_installments: list[dict] | None = None


class DocumentExtractionResponse(BaseModel):
    """Extracao salva no banco (para historico)"""
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
    """Informacoes do cartao extraidas de uma fatura"""
    # Identificacao do cartao
    card_issuer: str | None = None  # Codigo do emissor (nubank, itau, bradesco, bradescard)
    card_bank: str | None = None  # Nome completo do banco (Bradesco, Itau Unibanco)
    card_brand: str | None = None  # Bandeira (visa, mastercard, elo, hipercard, amex)
    card_partner: str | None = None  # Parceiro co-branded (amazon, smiles, latam)
    card_last_digits: str | None = None  # Ultimos 4 digitos
    card_name: str | None = None  # Nome completo do cartao (ex: Bradesco Amazon Visa)

    # Informacoes da fatura
    invoice_month: int | None = None
    invoice_year: int | None = None
    closing_date: str | None = None  # Data de fechamento YYYY-MM-DD
    closing_day: int | None = None  # Dia do fechamento (1-31)
    due_date: str | None = None  # Data de vencimento YYYY-MM-DD
    due_day: int | None = None  # Dia do vencimento (1-31)
    total_amount: float | None = None

    # Limites do cartao (se disponivel na fatura)
    credit_limit: float | None = None  # Limite total
    credit_used: float | None = None  # Limite utilizado
    credit_available: float | None = None  # Limite disponivel


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

    # Lista de itens extraidos (cada um e uma transacao potencial)
    extracted_items: list[ExtractedItemResponse] = []

    # Alerta de duplicata (nao bloqueia, apenas informa)
    is_duplicate: bool = False

    # Informacoes do cartao (apenas para fatura_cartao)
    card_info: CardInfoResponse | None = None

    class Config:
        from_attributes = True
