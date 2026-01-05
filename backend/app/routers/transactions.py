from datetime import date
from fastapi import APIRouter, Query

from ..core.deps import CurrentUser, DbSession
from ..schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    TransactionConfirm,
)
from ..services.transaction_service import TransactionService

router = APIRouter()


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    current_user: CurrentUser,
    db: DbSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category_id: int | None = Query(None),
    account_id: int | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Lista transações com filtros"""
    service = TransactionService(db)
    return await service.list(
        current_user,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        account_id=account_id,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma transação manual"""
    service = TransactionService(db)
    return await service.create(current_user, data)


class ConfirmTransactionResponse(TransactionResponse):
    """Resposta de confirmação com dados de parcelas"""
    series_id: int | None = None
    series_description: str | None = None
    additional_transactions_count: int = 0


@router.post("/confirm", response_model=ConfirmTransactionResponse, status_code=201)
async def confirm_transaction(
    data: TransactionConfirm,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Confirma transação a partir de documento processado (1 toque).

    Para parcelas, pode:
    - Criar nova série de parcelas automaticamente
    - Vincular a série existente
    - Marcar parcelas anteriores como pagas
    - Criar parcelas futuras
    """
    service = TransactionService(db)
    result = await service.confirm_from_document(current_user, data)

    transaction = result["transaction"]
    series = result.get("series")
    additional = result.get("created_transactions", [])

    response = ConfirmTransactionResponse(
        id=transaction.id,
        type=transaction.type,
        amount=float(transaction.amount),
        currency=transaction.currency,
        date=transaction.date,
        description=transaction.description,
        notes=transaction.notes,
        tags=transaction.tags,
        is_fixed=transaction.is_fixed,
        account_id=transaction.account_id,
        category_id=transaction.category_id,
        merchant_id=transaction.merchant_id,
        document_id=transaction.document_id,
        is_recurring=transaction.is_recurring,
        is_paid=transaction.is_paid,
        installment_series_id=transaction.installment_series_id,
        installment_number=transaction.installment_number,
        installment_total=transaction.installment_total,
        created_at=transaction.created_at,
        updated_at=transaction.updated_at,
        series_id=series.id if series else None,
        series_description=series.description if series else None,
        additional_transactions_count=len(additional),
    )

    return response


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna uma transação específica"""
    service = TransactionService(db)
    transaction = await service.get_by_id(current_user, transaction_id)
    if not transaction:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return transaction


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza uma transação"""
    service = TransactionService(db)
    return await service.update(current_user, transaction_id, data)


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove uma transação"""
    service = TransactionService(db)
    await service.delete(current_user, transaction_id)
