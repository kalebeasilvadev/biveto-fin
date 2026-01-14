from __future__ import annotations
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, or_, and_, func
from decimal import Decimal
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.credit_card import CreditCard
from app.models.account import Account, AccountType
from app.models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from app.models.household import HouseholdMember
from app.modules.credit_cards.services.invoice_service import InvoiceService
from app.modules.credit_cards.schemas.credit_card import (
    CreditCardCreate,
    CreditCardUpdate,
    CreditCardResponse,
    CreditCardListResponse,
)

router = APIRouter()


async def get_household_user_ids(db, user) -> list[int]:
    """Get all user IDs in the same household/license as the user"""
    if not user.license_id:
        return []

    result = await db.execute(
        select(HouseholdMember.user_id).where(
            HouseholdMember.license_id == user.license_id
        )
    )
    return list(result.scalars().all())


@router.get("", response_model=list[CreditCardListResponse])
async def list_credit_cards(current_user: CurrentUser, db: DbSession):
    """Lista todos os cartoes de credito do usuario"""
    household_user_ids = await get_household_user_ids(db, current_user)

    if household_user_ids:
        result = await db.execute(
            select(CreditCard, Account)
            .join(Account, CreditCard.account_id == Account.id)
            .where(
                or_(
                    and_(
                        CreditCard.user_id == current_user.id,
                        Account.ownership_type == "personal"
                    ),
                    and_(
                        CreditCard.user_id.in_(household_user_ids),
                        Account.ownership_type == "household"
                    )
                )
            )
        )
    else:
        result = await db.execute(
            select(CreditCard, Account)
            .join(Account, CreditCard.account_id == Account.id)
            .where(CreditCard.user_id == current_user.id)
        )

    cards = result.all()

    # Calcular saldo em aberto para cada cartao a partir das faturas abertas
    card_ids = [card.id for card, _ in cards]
    used_limits = {}

    if card_ids:
        # Soma o valor restante (total_amount - paid_amount) de faturas com status 'open'
        # Exclui faturas 'closed' (aparecem separadas) e 'paid' (ja pagas)
        invoice_result = await db.execute(
            select(
                CreditCardInvoice.credit_card_id,
                func.coalesce(
                    func.sum(CreditCardInvoice.total_amount - CreditCardInvoice.paid_amount),
                    0
                ).label('total_used')
            )
            .where(
                CreditCardInvoice.credit_card_id.in_(card_ids),
                CreditCardInvoice.status == InvoiceStatus.OPEN.value
            )
            .group_by(CreditCardInvoice.credit_card_id)
        )
        for row in invoice_result:
            used_limits[row.credit_card_id] = float(row.total_used)

    return [
        CreditCardListResponse(
            id=card.id,
            account_id=card.account_id,
            name=account.name,
            credit_limit=float(card.credit_limit),
            current_balance=used_limits.get(card.id, 0.0),
            available_limit=float(card.credit_limit) - used_limits.get(card.id, 0.0),
            closing_day=card.closing_day,
            due_day=card.due_day,
            has_points=card.has_points,
            points_program=card.points_program,
            points_factor=float(card.points_factor) if card.points_factor else None,
            card_brand=card.card_brand,
            card_variant=card.card_variant,
            last_four_digits=card.last_four_digits,
            annual_fee=float(card.annual_fee) if card.annual_fee else None,
            annual_fee_frequency=card.annual_fee_frequency,
            annual_fee_waived=card.annual_fee_waived,
            color=account.color,
            icon=account.icon,
            is_active=card.is_active,
        )
        for card, account in cards
    ]


@router.post("", response_model=CreditCardResponse, status_code=201)
async def create_credit_card(
    data: CreditCardCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria um novo cartao de credito (cria conta associada automaticamente)"""
    # Create the linked account
    account = Account(
        user_id=current_user.id,
        name=data.name,
        type=AccountType.CREDIT_CARD.value,
        balance=data.initial_balance,
        currency="BRL",
        color=data.color,
        icon=data.icon,
        ownership_type="personal",
    )
    db.add(account)
    await db.flush()  # Get account.id

    # Create the credit card
    credit_card = CreditCard(
        account_id=account.id,
        user_id=current_user.id,
        credit_limit=data.credit_limit,
        closing_day=data.closing_day,
        due_day=data.due_day,
        has_points=data.has_points,
        points_program=data.points_program.value if data.points_program else None,
        points_program_name=data.points_program_name,
        points_factor=data.points_factor,
        points_factor_international=data.points_factor_international,
        card_brand=data.card_brand,
        card_variant=data.card_variant,
        last_four_digits=data.last_four_digits,
        annual_fee=data.annual_fee,
        annual_fee_frequency=data.annual_fee_frequency,
        annual_fee_waived=data.annual_fee_waived,
        benefits_notes=data.benefits_notes,
    )
    db.add(credit_card)
    await db.commit()
    await db.refresh(credit_card)
    await db.refresh(account)

    return CreditCardResponse(
        id=credit_card.id,
        account_id=credit_card.account_id,
        user_id=credit_card.user_id,
        credit_limit=float(credit_card.credit_limit),
        closing_day=credit_card.closing_day,
        due_day=credit_card.due_day,
        has_points=credit_card.has_points,
        points_program=credit_card.points_program,
        points_program_name=credit_card.points_program_name,
        points_factor=float(credit_card.points_factor),
        points_factor_international=float(credit_card.points_factor_international) if credit_card.points_factor_international else None,
        card_brand=credit_card.card_brand,
        card_variant=credit_card.card_variant,
        last_four_digits=credit_card.last_four_digits,
        annual_fee=float(credit_card.annual_fee) if credit_card.annual_fee else None,
        annual_fee_waived=credit_card.annual_fee_waived,
        benefits_notes=credit_card.benefits_notes,
        is_active=credit_card.is_active,
        created_at=credit_card.created_at,
        updated_at=credit_card.updated_at,
        account_name=account.name,
        account_balance=float(account.balance),
        account_color=account.color,
        account_icon=account.icon,
    )


@router.get("/{card_id}", response_model=CreditCardResponse)
async def get_credit_card(
    card_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna um cartao de credito especifico"""
    result = await db.execute(
        select(CreditCard, Account)
        .join(Account, CreditCard.account_id == Account.id)
        .where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Cartao nao encontrado")

    card, account = row

    return CreditCardResponse(
        id=card.id,
        account_id=card.account_id,
        user_id=card.user_id,
        credit_limit=float(card.credit_limit),
        closing_day=card.closing_day,
        due_day=card.due_day,
        has_points=card.has_points,
        points_program=card.points_program,
        points_program_name=card.points_program_name,
        points_factor=float(card.points_factor),
        points_factor_international=float(card.points_factor_international) if card.points_factor_international else None,
        card_brand=card.card_brand,
        card_variant=card.card_variant,
        last_four_digits=card.last_four_digits,
        annual_fee=float(card.annual_fee) if card.annual_fee else None,
        annual_fee_waived=card.annual_fee_waived,
        benefits_notes=card.benefits_notes,
        is_active=card.is_active,
        created_at=card.created_at,
        updated_at=card.updated_at,
        account_name=account.name,
        account_balance=float(account.balance),
        account_color=account.color,
        account_icon=account.icon,
    )


@router.patch("/{card_id}", response_model=CreditCardResponse)
async def update_credit_card(
    card_id: int,
    data: CreditCardUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza um cartao de credito"""
    result = await db.execute(
        select(CreditCard, Account)
        .join(Account, CreditCard.account_id == Account.id)
        .where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Cartao nao encontrado")

    card, account = row

    # Update card fields
    card_fields = [
        "credit_limit", "closing_day", "due_day", "has_points",
        "points_program", "points_program_name", "points_factor",
        "points_factor_international", "card_brand", "card_variant",
        "last_four_digits", "annual_fee", "annual_fee_frequency",
        "annual_fee_waived", "benefits_notes", "is_active"
    ]
    account_fields = ["name", "color", "icon"]

    update_data = data.model_dump(exclude_unset=True)

    for field in card_fields:
        if field in update_data:
            value = update_data[field]
            if field == "points_program" and value:
                value = value.value
            setattr(card, field, value)

    for field in account_fields:
        if field in update_data:
            setattr(account, field, update_data[field])

    await db.commit()
    await db.refresh(card)
    await db.refresh(account)

    return CreditCardResponse(
        id=card.id,
        account_id=card.account_id,
        user_id=card.user_id,
        credit_limit=float(card.credit_limit),
        closing_day=card.closing_day,
        due_day=card.due_day,
        has_points=card.has_points,
        points_program=card.points_program,
        points_program_name=card.points_program_name,
        points_factor=float(card.points_factor),
        points_factor_international=float(card.points_factor_international) if card.points_factor_international else None,
        card_brand=card.card_brand,
        card_variant=card.card_variant,
        last_four_digits=card.last_four_digits,
        annual_fee=float(card.annual_fee) if card.annual_fee else None,
        annual_fee_waived=card.annual_fee_waived,
        benefits_notes=card.benefits_notes,
        is_active=card.is_active,
        created_at=card.created_at,
        updated_at=card.updated_at,
        account_name=account.name,
        account_balance=float(account.balance),
        account_color=account.color,
        account_icon=account.icon,
    )


@router.delete("/{card_id}", status_code=204)
async def delete_credit_card(
    card_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove um cartao de credito (e sua conta associada)"""
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Cartao nao encontrado")

    # Deleting the card will cascade delete the account due to ondelete="CASCADE"
    # Actually, account has the cascade, so we need to delete account first
    account_result = await db.execute(
        select(Account).where(Account.id == card.account_id)
    )
    account = account_result.scalar_one_or_none()

    if account:
        await db.delete(account)  # This cascades to delete the card
    else:
        await db.delete(card)

    await db.commit()


class ProjectRecurringResponse(BaseModel):
    """Resposta da projecao de recorrentes"""
    message: str
    transactions_created: int
    months_projected: int


@router.post("/{card_id}/project-recurring", response_model=ProjectRecurringResponse)
async def project_recurring_transactions(
    card_id: int,
    current_user: CurrentUser,
    db: DbSession,
    months_ahead: int = Query(6, ge=1, le=12, description="Numero de meses para projetar"),
):
    """
    Projeta transacoes recorrentes para faturas futuras do cartao.

    Busca todas as transacoes recorrentes ativas vinculadas ao cartao
    e cria projecoes (is_paid=False) para os proximos N meses.
    """
    # Verificar se o cartao pertence ao usuario
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Cartao nao encontrado")

    # Projetar recorrentes
    service = InvoiceService(db)
    created_transactions = await service.project_recurring_to_invoices(
        user=current_user,
        credit_card=card,
        months_ahead=months_ahead,
    )

    return ProjectRecurringResponse(
        message=f"Projecao concluida com sucesso",
        transactions_created=len(created_transactions),
        months_projected=months_ahead,
    )
