"""Installments module schemas"""

from app.modules.installments.schemas.installment import (
    InstallmentSeriesBase,
    InstallmentSeriesCreate,
    InstallmentSeriesResponse,
    InstallmentStatusResponse,
    InstallmentSeriesDetailResponse,
    ConfirmInstallmentRequest,
    MarkInstallmentsPaidRequest,
    CreateFutureInstallmentsRequest,
)

__all__ = [
    "InstallmentSeriesBase",
    "InstallmentSeriesCreate",
    "InstallmentSeriesResponse",
    "InstallmentStatusResponse",
    "InstallmentSeriesDetailResponse",
    "ConfirmInstallmentRequest",
    "MarkInstallmentsPaidRequest",
    "CreateFutureInstallmentsRequest",
]
