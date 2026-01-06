from fastapi import APIRouter, HTTPException, Query

from ..core.deps import CurrentUser, DbSession
from ..schemas.recurring import (
    RecurringCreate,
    RecurringUpdate,
    RecurringResponse,
    RecurringSummary,
)
from ..services.recurring_service import RecurringTransactionService

router = APIRouter()


@router.post("", response_model=RecurringResponse, status_code=201)
async def create_recurring(
    data: RecurringCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma nova transação recorrente"""
    service = RecurringTransactionService(db)
    try:
        recurring = await service.create(current_user, data)
        # Buscar novamente com relacionamentos
        result = await service.get_by_id(current_user, recurring.id)
        return RecurringResponse(
            id=result.id,
            name=result.name,
            description=result.description,
            amount=float(result.amount),
            type=result.type,
            account_id=result.account_id,
            account_name=result.account.name if result.account else None,
            category_id=result.category_id,
            category_name=result.category.name if result.category else None,
            frequency=result.frequency,
            day_of_month=result.day_of_month,
            day_of_week=result.day_of_week,
            start_date=result.start_date,
            end_date=result.end_date,
            status=result.status,
            last_generated_date=result.last_generated_date,
            next_due_date=result.next_due_date,
            created_at=result.created_at,
            updated_at=result.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[RecurringResponse])
async def list_recurring(
    current_user: CurrentUser,
    db: DbSession,
    include_inactive: bool = Query(False, description="Incluir canceladas"),
):
    """Lista transações recorrentes do usuário"""
    service = RecurringTransactionService(db)
    return await service.list(current_user, include_inactive=include_inactive)


@router.get("/summary", response_model=RecurringSummary)
async def get_summary(
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna resumo das transações recorrentes"""
    service = RecurringTransactionService(db)
    return await service.get_summary(current_user)


@router.get("/{recurring_id}", response_model=RecurringResponse)
async def get_recurring(
    recurring_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna uma transação recorrente por ID"""
    service = RecurringTransactionService(db)
    result = await service.get_by_id(current_user, recurring_id)
    if not result:
        raise HTTPException(status_code=404, detail="Transação recorrente não encontrada")

    return RecurringResponse(
        id=result.id,
        name=result.name,
        description=result.description,
        amount=float(result.amount),
        type=result.type,
        account_id=result.account_id,
        account_name=result.account.name if result.account else None,
        category_id=result.category_id,
        category_name=result.category.name if result.category else None,
        frequency=result.frequency,
        day_of_month=result.day_of_month,
        day_of_week=result.day_of_week,
        start_date=result.start_date,
        end_date=result.end_date,
        status=result.status,
        last_generated_date=result.last_generated_date,
        next_due_date=result.next_due_date,
        created_at=result.created_at,
        updated_at=result.updated_at,
    )


@router.patch("/{recurring_id}", response_model=RecurringResponse)
async def update_recurring(
    recurring_id: int,
    data: RecurringUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza uma transação recorrente"""
    service = RecurringTransactionService(db)
    try:
        result = await service.update(current_user, recurring_id, data)
        if not result:
            raise HTTPException(status_code=404, detail="Transação recorrente não encontrada")

        # Recarregar com relacionamentos
        result = await service.get_by_id(current_user, recurring_id)
        return RecurringResponse(
            id=result.id,
            name=result.name,
            description=result.description,
            amount=float(result.amount),
            type=result.type,
            account_id=result.account_id,
            account_name=result.account.name if result.account else None,
            category_id=result.category_id,
            category_name=result.category.name if result.category else None,
            frequency=result.frequency,
            day_of_month=result.day_of_month,
            day_of_week=result.day_of_week,
            start_date=result.start_date,
            end_date=result.end_date,
            status=result.status,
            last_generated_date=result.last_generated_date,
            next_due_date=result.next_due_date,
            created_at=result.created_at,
            updated_at=result.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{recurring_id}", status_code=204)
async def delete_recurring(
    recurring_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove uma transação recorrente"""
    service = RecurringTransactionService(db)
    success = await service.delete(current_user, recurring_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transação recorrente não encontrada")


@router.post("/{recurring_id}/pause", response_model=RecurringResponse)
async def pause_recurring(
    recurring_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Pausa uma transação recorrente"""
    service = RecurringTransactionService(db)
    result = await service.pause(current_user, recurring_id)
    if not result:
        raise HTTPException(status_code=404, detail="Transação recorrente não encontrada")

    result = await service.get_by_id(current_user, recurring_id)
    return RecurringResponse(
        id=result.id,
        name=result.name,
        description=result.description,
        amount=float(result.amount),
        type=result.type,
        account_id=result.account_id,
        account_name=result.account.name if result.account else None,
        category_id=result.category_id,
        category_name=result.category.name if result.category else None,
        frequency=result.frequency,
        day_of_month=result.day_of_month,
        day_of_week=result.day_of_week,
        start_date=result.start_date,
        end_date=result.end_date,
        status=result.status,
        last_generated_date=result.last_generated_date,
        next_due_date=result.next_due_date,
        created_at=result.created_at,
        updated_at=result.updated_at,
    )


@router.post("/{recurring_id}/resume", response_model=RecurringResponse)
async def resume_recurring(
    recurring_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retoma uma transação recorrente pausada"""
    service = RecurringTransactionService(db)
    result = await service.resume(current_user, recurring_id)
    if not result:
        raise HTTPException(status_code=404, detail="Transação recorrente não encontrada")

    result = await service.get_by_id(current_user, recurring_id)
    return RecurringResponse(
        id=result.id,
        name=result.name,
        description=result.description,
        amount=float(result.amount),
        type=result.type,
        account_id=result.account_id,
        account_name=result.account.name if result.account else None,
        category_id=result.category_id,
        category_name=result.category.name if result.category else None,
        frequency=result.frequency,
        day_of_month=result.day_of_month,
        day_of_week=result.day_of_week,
        start_date=result.start_date,
        end_date=result.end_date,
        status=result.status,
        last_generated_date=result.last_generated_date,
        next_due_date=result.next_due_date,
        created_at=result.created_at,
        updated_at=result.updated_at,
    )


@router.post("/generate", response_model=dict)
async def generate_transactions(
    current_user: CurrentUser,
    db: DbSession,
):
    """Gera transações pendentes para recorrências vencidas"""
    service = RecurringTransactionService(db)
    generated = await service.generate_pending_transactions(current_user)
    return {"generated_count": len(generated)}
