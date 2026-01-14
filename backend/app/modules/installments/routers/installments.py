"""Endpoints para gerenciamento de séries de parcelas"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DbSession
from app.models.installment import InstallmentSeriesStatus
from app.modules.installments.schemas.installment import (
    InstallmentSeriesCreate,
    InstallmentSeriesResponse,
    InstallmentSeriesDetailResponse,
    MarkInstallmentsPaidRequest,
    CreateFutureInstallmentsRequest,
)
from app.modules.transactions.schemas.transaction import TransactionResponse
from app.modules.installments.services.installment_service import InstallmentService

router = APIRouter(prefix="/installments", tags=["installments"])


@router.get("", response_model=list[InstallmentSeriesResponse])
async def list_installment_series(
    current_user: CurrentUser,
    db: DbSession,
    status_filter: str | None = None,
    limit: int = 50,
):
    """Lista séries de parcelas do usuário"""
    service = InstallmentService(db)

    status_enum = None
    if status_filter:
        try:
            status_enum = InstallmentSeriesStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status inválido. Use: active, completed, cancelled"
            )

    series_list = await service.get_user_series(
        user=current_user,
        status_filter=status_enum,
        limit=limit,
    )

    # Converter para response com campos calculados
    result = []
    for series in series_list:
        result.append(InstallmentSeriesResponse(
            id=series.id,
            description=series.description,
            merchant_name=series.merchant_name,
            total_amount=float(series.total_amount),
            installment_amount=float(series.installment_amount),
            installment_count=series.installment_count,
            paid_count=series.paid_count,
            remaining_count=series.remaining_count,
            remaining_amount=series.remaining_amount,
            first_installment_date=series.first_installment_date,
            purchase_date=series.purchase_date,
            account_id=series.account_id,
            category_id=series.category_id,
            status=series.status,
            created_at=series.created_at,
            updated_at=series.updated_at,
        ))

    return result


@router.post("", response_model=InstallmentSeriesResponse, status_code=201)
async def create_installment_series(
    data: InstallmentSeriesCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma nova série de parcelas"""
    service = InstallmentService(db)

    series = await service.create_series(
        user=current_user,
        description=data.description,
        merchant_name=data.merchant_name,
        installment_amount=data.installment_amount,
        installment_count=data.installment_count,
        first_installment_date=data.first_installment_date,
        account_id=data.account_id,
        category_id=data.category_id,
        purchase_date=data.purchase_date,
    )

    # Se solicitado, marcar parcelas anteriores como pagas
    if data.mark_paid_until and data.mark_paid_until > 0:
        await service.mark_previous_installments_as_paid(
            user=current_user,
            series=series,
            up_to_installment=data.mark_paid_until + 1,  # +1 porque é exclusivo
        )
        await db.refresh(series)

    # Se solicitado, criar parcelas futuras
    if data.create_future:
        start_from = data.mark_paid_until if data.mark_paid_until else 0
        await service.create_future_installments(
            user=current_user,
            series=series,
            from_installment=start_from,
        )

    return InstallmentSeriesResponse(
        id=series.id,
        description=series.description,
        merchant_name=series.merchant_name,
        total_amount=float(series.total_amount),
        installment_amount=float(series.installment_amount),
        installment_count=series.installment_count,
        paid_count=series.paid_count,
        remaining_count=series.remaining_count,
        remaining_amount=series.remaining_amount,
        first_installment_date=series.first_installment_date,
        purchase_date=series.purchase_date,
        account_id=series.account_id,
        category_id=series.category_id,
        status=series.status,
        created_at=series.created_at,
        updated_at=series.updated_at,
    )


@router.get("/{series_id}", response_model=InstallmentSeriesDetailResponse)
async def get_installment_series_detail(
    series_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Obtém detalhes de uma série de parcelas com status de cada parcela"""
    service = InstallmentService(db)

    series = await service.get_series_by_id(current_user, series_id)
    if not series:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Série de parcelas não encontrada"
        )

    status_data = await service.get_series_status(series)
    return InstallmentSeriesDetailResponse(**status_data)


@router.post("/{series_id}/mark-paid", response_model=list[TransactionResponse])
async def mark_installments_as_paid(
    series_id: int,
    data: MarkInstallmentsPaidRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Marca parcelas anteriores como pagas (retroativamente)"""
    service = InstallmentService(db)

    series = await service.get_series_by_id(current_user, series_id)
    if not series:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Série de parcelas não encontrada"
        )

    if data.up_to_installment > series.installment_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parcela {data.up_to_installment} excede o total de {series.installment_count}"
        )

    transactions = await service.mark_previous_installments_as_paid(
        user=current_user,
        series=series,
        up_to_installment=data.up_to_installment + 1,
    )

    await db.commit()

    return [
        TransactionResponse(
            id=t.id,
            type=t.type,
            amount=float(t.amount),
            currency=t.currency,
            date=t.date,
            description=t.description,
            notes=t.notes,
            tags=t.tags,
            is_fixed=t.is_fixed,
            account_id=t.account_id,
            category_id=t.category_id,
            merchant_id=t.merchant_id,
            document_id=t.document_id,
            is_recurring=t.is_recurring,
            is_paid=t.is_paid,
            installment_series_id=t.installment_series_id,
            installment_number=t.installment_number,
            installment_total=t.installment_total,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in transactions
    ]


@router.post("/{series_id}/create-future", response_model=list[TransactionResponse])
async def create_future_installments(
    series_id: int,
    data: CreateFutureInstallmentsRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria transações para parcelas futuras (não pagas)"""
    service = InstallmentService(db)

    series = await service.get_series_by_id(current_user, series_id)
    if not series:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Série de parcelas não encontrada"
        )

    if data.from_installment > series.installment_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parcela {data.from_installment} excede o total de {series.installment_count}"
        )

    transactions = await service.create_future_installments(
        user=current_user,
        series=series,
        from_installment=data.from_installment,
    )

    await db.commit()

    return [
        TransactionResponse(
            id=t.id,
            type=t.type,
            amount=float(t.amount),
            currency=t.currency,
            date=t.date,
            description=t.description,
            notes=t.notes,
            tags=t.tags,
            is_fixed=t.is_fixed,
            account_id=t.account_id,
            category_id=t.category_id,
            merchant_id=t.merchant_id,
            document_id=t.document_id,
            is_recurring=t.is_recurring,
            is_paid=t.is_paid,
            installment_series_id=t.installment_series_id,
            installment_number=t.installment_number,
            installment_total=t.installment_total,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in transactions
    ]


@router.delete("/{series_id}", status_code=204)
async def cancel_installment_series(
    series_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cancela uma série de parcelas (não exclui transações já criadas)"""
    service = InstallmentService(db)

    series = await service.get_series_by_id(current_user, series_id)
    if not series:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Série de parcelas não encontrada"
        )

    series.status = InstallmentSeriesStatus.CANCELLED
    await db.commit()


@router.post("/analyze")
async def analyze_installment(
    item: dict,
    account_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Analisa um item extraído e verifica se é parcela de série existente.

    Retorna sugestões de ação:
    - create_single: Criar transação única (não é parcela)
    - create_series: Criar nova série de parcelas
    - add_to_series: Adicionar à série existente
    - mark_previous_paid: Série existe, mas há parcelas anteriores pendentes
    - skip: Parcela já existe na série
    """
    service = InstallmentService(db)
    return await service.analyze_extracted_item(
        user=current_user,
        item=item,
        account_id=account_id,
    )
