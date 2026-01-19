"""
Envelope Budgeting API Routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.modules.envelopes.services import EnvelopeService
from app.modules.envelopes.schemas import (
    EnvelopeCreate,
    EnvelopeUpdate,
    EnvelopeResponse,
    EnvelopeSummary,
    DailyAllowance,
    EnvelopeTransfer,
    EnvelopeHistoryResponse,
)

router = APIRouter(prefix="/envelopes", tags=["Envelope Budgeting"])


@router.post("", response_model=EnvelopeResponse)
async def create_envelope(
    data: EnvelopeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new spending envelope."""
    try:
        service = EnvelopeService(db)
        envelope = await service.create(current_user, data)
        # Reload with category relationship
        return await service.get_by_id(current_user, envelope.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[EnvelopeResponse])
async def list_envelopes(
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all spending envelopes."""
    service = EnvelopeService(db)
    return await service.list(current_user, include_inactive)


@router.get("/summary", response_model=EnvelopeSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get summary of all envelopes."""
    service = EnvelopeService(db)
    return await service.get_summary(current_user)


@router.get("/{envelope_id}", response_model=EnvelopeResponse)
async def get_envelope(
    envelope_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific envelope."""
    service = EnvelopeService(db)
    envelope = await service.get_by_id(current_user, envelope_id)
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope não encontrado")
    return service._to_response(envelope)


@router.patch("/{envelope_id}", response_model=EnvelopeResponse)
async def update_envelope(
    envelope_id: int,
    data: EnvelopeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an envelope."""
    try:
        service = EnvelopeService(db)
        envelope = await service.update(current_user, envelope_id, data)
        if not envelope:
            raise HTTPException(status_code=404, detail="Envelope não encontrado")
        return service._to_response(envelope)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{envelope_id}")
async def delete_envelope(
    envelope_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an envelope."""
    service = EnvelopeService(db)
    success = await service.delete(current_user, envelope_id)
    if not success:
        raise HTTPException(status_code=404, detail="Envelope não encontrado")
    return {"message": "Envelope removido com sucesso"}


@router.get("/{envelope_id}/daily-allowance", response_model=DailyAllowance)
async def get_daily_allowance(
    envelope_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get daily spending allowance for an envelope."""
    try:
        service = EnvelopeService(db)
        return await service.get_daily_allowance(current_user, envelope_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{envelope_id}/history", response_model=list[EnvelopeHistoryResponse])
async def get_envelope_history(
    envelope_id: int,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get history for an envelope."""
    try:
        service = EnvelopeService(db)
        return await service.get_history(current_user, envelope_id, limit)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{envelope_id}/refill", response_model=EnvelopeResponse)
async def refill_envelope(
    envelope_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually refill an envelope."""
    service = EnvelopeService(db)
    envelope = await service.get_by_id(current_user, envelope_id)
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope não encontrado")

    await service.refill_envelope(envelope)
    return service._to_response(envelope)


@router.post("/transfer")
async def transfer_between_envelopes(
    transfer: EnvelopeTransfer,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transfer funds between two envelopes."""
    try:
        service = EnvelopeService(db)
        from_env, to_env = await service.transfer_between_envelopes(
            current_user, transfer
        )
        return {
            "message": "Transferência realizada com sucesso",
            "from_envelope": service._to_response(from_env),
            "to_envelope": service._to_response(to_env),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auto-assign")
async def auto_assign_transaction(
    transaction_id: int = Query(..., description="Transaction ID to auto-assign"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Auto-assign a transaction to an envelope based on category."""
    from app.models import Transaction
    from sqlalchemy import select

    # Get transaction
    query = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    )
    result = await db.execute(query)
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    if transaction.type != "expense":
        raise HTTPException(status_code=400, detail="Apenas despesas podem ser atribuídas a envelopes")

    if not transaction.category_id:
        raise HTTPException(status_code=400, detail="Transação sem categoria")

    service = EnvelopeService(db)
    envelope = await service.find_by_category(current_user, transaction.category_id)

    if not envelope:
        raise HTTPException(
            status_code=404,
            detail="Nenhum envelope encontrado para esta categoria"
        )

    await service.spend_from_envelope(
        envelope,
        transaction.amount,
        transaction_id=transaction.id,
        notes=f"Auto: {transaction.description}"
    )

    return {
        "message": "Transação atribuída ao envelope",
        "envelope": service._to_response(envelope),
    }
