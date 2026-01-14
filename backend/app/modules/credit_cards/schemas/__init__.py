"""Credit Cards Schemas"""

from app.modules.credit_cards.schemas.credit_card import (
    CreditCardBase,
    CreditCardCreate,
    CreditCardUpdate,
    CreditCardResponse,
    CreditCardListResponse,
)
from app.modules.credit_cards.schemas.invoice import (
    InvoiceBase,
    InvoiceCreate,
    InvoiceFromDocument,
    InvoiceUpdate,
    InvoicePayment,
    InvoiceResponse,
    InvoiceDetailResponse,
    InvoiceTransactionResponse,
    InvoiceSummary,
    CardDetectionResult,
    DetectedCardInfo,
)

__all__ = [
    # Credit Card Schemas
    "CreditCardBase",
    "CreditCardCreate",
    "CreditCardUpdate",
    "CreditCardResponse",
    "CreditCardListResponse",
    # Invoice Schemas
    "InvoiceBase",
    "InvoiceCreate",
    "InvoiceFromDocument",
    "InvoiceUpdate",
    "InvoicePayment",
    "InvoiceResponse",
    "InvoiceDetailResponse",
    "InvoiceTransactionResponse",
    "InvoiceSummary",
    "CardDetectionResult",
    "DetectedCardInfo",
]
