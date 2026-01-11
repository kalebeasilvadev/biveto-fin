from __future__ import annotations

from datetime import date
import csv
import io
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..core.deps import CurrentUser, DbSession
from ..schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    TransactionConfirm,
)
from ..services.transaction_service import TransactionService

router = APIRouter()


class PaginatedTransactions(BaseModel):
    items: list[TransactionResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


@router.get("", response_model=PaginatedTransactions)
async def list_transactions(
    current_user: CurrentUser,
    db: DbSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category_id: int | None = Query(None),
    account_id: int | None = Query(None),
    search: str | None = Query(None, min_length=2, max_length=100),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
):
    """Lista transações com filtros, busca e paginação"""
    service = TransactionService(db)

    items = await service.list(
        current_user,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        account_id=account_id,
        search=search,
        limit=limit,
        offset=offset,
    )

    total = await service.count(
        current_user,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        account_id=account_id,
        search=search,
    )

    return PaginatedTransactions(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


@router.get("/export/csv")
async def export_transactions_csv(
    current_user: CurrentUser,
    db: DbSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category_id: int | None = Query(None),
    account_id: int | None = Query(None),
):
    """Exporta transações em formato CSV"""
    service = TransactionService(db)
    transactions = await service.list(
        current_user,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        account_id=account_id,
        limit=10000,  # Higher limit for exports
        offset=0,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Data",
        "Tipo",
        "Descrição",
        "Categoria",
        "Conta",
        "Valor",
        "Estabelecimento",
        "Parcela",
    ])

    # Data rows
    for t in transactions:
        tipo = "Receita" if t.type == "income" else "Despesa"
        valor = f"{t.amount:.2f}"
        parcela = f"{t.installment_number}/{t.installment_total}" if t.installment_total else ""
        writer.writerow([
            t.date.strftime("%d/%m/%Y"),
            tipo,
            t.description or "",
            t.category_name or "Sem categoria",
            t.account_name or "",
            valor,
            t.merchant_name or "",
            parcela,
        ])

    output.seek(0)
    filename = f"transacoes_{date.today().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        },
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


class ExtractedItemCheck(BaseModel):
    """Item extraído para verificar se existe projeção"""
    index: int
    description: str
    amount: float
    date: Optional[date] = None
    is_installment: bool = False
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None


class ProjectedMatchResult(BaseModel):
    """Resultado da verificação de match com projeção"""
    index: int
    has_projected: bool
    projected_transaction_id: Optional[int] = None
    projected_date: Optional[date] = None
    series_id: Optional[int] = None
    series_description: Optional[str] = None
    message: Optional[str] = None


class CheckProjectedRequest(BaseModel):
    """Request para verificar projeções"""
    items: list[ExtractedItemCheck]
    credit_card_id: Optional[int] = None
    invoice_month: Optional[int] = None
    invoice_year: Optional[int] = None


class CheckProjectedResponse(BaseModel):
    """Response com resultados das verificações"""
    results: list[ProjectedMatchResult]
    total_projected: int


@router.post("/check-projected", response_model=CheckProjectedResponse)
async def check_projected_transactions(
    data: CheckProjectedRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Verifica quais itens extraídos têm parcelas/transações projetadas.

    Usado pelo frontend para mostrar ao usuário quais itens já existem
    como projeções futuras e serão confirmados ao invés de criados.
    """
    from ..services.installment_service import InstallmentService

    installment_service = InstallmentService(db)
    results = []
    total_projected = 0

    for item in data.items:
        result = ProjectedMatchResult(
            index=item.index,
            has_projected=False,
        )

        if item.is_installment and item.installment_current and item.installment_total:
            # Para itens parcelados, buscar série existente
            series = await installment_service.find_matching_series(
                user=current_user,
                merchant_name=item.description,
                installment_amount=item.amount,
                installment_total=item.installment_total,
                account_id=None,  # Não temos account_id aqui
                transaction_date=item.date,
                installment_number=item.installment_current,
            )

            if series:
                # Verificar se existe parcela projetada
                existing = await installment_service.find_existing_installment(
                    series, item.installment_current
                )

                if existing and not existing.is_paid:
                    result.has_projected = True
                    result.projected_transaction_id = existing.id
                    result.projected_date = existing.date
                    result.series_id = series.id
                    result.series_description = series.description
                    result.message = f"Parcela {item.installment_current}/{item.installment_total} já projetada para {existing.date.strftime('%d/%m/%Y')}"
                    total_projected += 1
                elif existing and existing.is_paid:
                    result.message = f"Parcela {item.installment_current}/{item.installment_total} já confirmada em {existing.date.strftime('%d/%m/%Y')}"

        results.append(result)

    return CheckProjectedResponse(
        results=results,
        total_projected=total_projected,
    )
