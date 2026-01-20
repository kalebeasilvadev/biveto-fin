"""
Schemas for QR Code scanning feature
"""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class QRCodeScanRequest(BaseModel):
    """Request to scan QR code from image"""
    image_base64: str | None = Field(
        None,
        description="Imagem em base64 (com ou sem prefixo data URI)"
    )
    url: str | None = Field(
        None,
        description="URL da NFCe (alternativa ao scan de imagem)"
    )
    access_key: str | None = Field(
        None,
        description="Chave de acesso de 44 dígitos (alternativa ao scan de imagem)"
    )


class QRCodeExtractionResponse(BaseModel):
    """Response from QR code extraction (step 1)"""
    success: bool
    url: str | None = None
    access_key: str | None = None
    error: str | None = None


class NFCeItemResponse(BaseModel):
    """Single item from NFCe"""
    codigo: str | None = None
    descricao: str
    quantidade: float
    unidade: str
    valor_unitario: float
    valor_total: float
    ncm: str | None = None


class NFCeDataResponse(BaseModel):
    """Complete NFCe data response"""
    chave_acesso: str
    data_emissao: datetime
    cnpj_emitente: str
    nome_emitente: str
    valor_total: float
    itens: list[NFCeItemResponse]
    endereco_emitente: str | None = None
    forma_pagamento: str | None = None


class NFCeFetchResponse(BaseModel):
    """Response from NFCe fetch (step 2)"""
    success: bool
    data: NFCeDataResponse | None = None
    error: str | None = None
    error_type: str | None = None  # 'not_found', 'not_available', 'timeout', 'parse_error'
    fallback_suggested: bool = False  # Suggest using photo upload instead


class QRCodeFullScanResponse(BaseModel):
    """
    Response from complete QR code scan (extraction + fetch).
    Used when user scans QR code and expects immediate results.
    """
    # QR Code extraction result
    qr_extraction_success: bool
    qr_url: str | None = None
    qr_access_key: str | None = None
    qr_error: str | None = None

    # NFCe fetch result (only if QR extraction succeeded)
    nfce_fetch_success: bool = False
    nfce_data: NFCeDataResponse | None = None
    nfce_error: str | None = None
    nfce_error_type: str | None = None

    # Overall status
    fallback_suggested: bool = False
    message: str | None = None
