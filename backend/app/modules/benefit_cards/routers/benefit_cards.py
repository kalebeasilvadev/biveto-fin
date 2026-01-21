from __future__ import annotations
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, or_, and_

from app.core.deps import CurrentUser, DbSession
from app.models.benefit_card import BenefitCard, BenefitCardType, BenefitCardProvider
from app.models.account import Account, AccountType
from app.models.household import HouseholdMember
from app.modules.benefit_cards.schemas.benefit_card import (
    BenefitCardCreate,
    BenefitCardUpdate,
    BenefitCardResponse,
    BenefitCardListResponse,
)
from app.modules.household.utils.household_helpers import validate_create_permission

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


def get_card_type_display(card_type: str) -> str:
    """Retorna nome amigavel do tipo de cartao"""
    display_names = {
        BenefitCardType.VA.value: "Vale Alimentacao",
        BenefitCardType.VR.value: "Vale Refeicao",
        BenefitCardType.FLEX.value: "Flex (VA/VR)",
        BenefitCardType.VT.value: "Vale Transporte",
        BenefitCardType.CULTURA.value: "Vale Cultura",
        BenefitCardType.COMBUSTIVEL.value: "Vale Combustivel",
    }
    return display_names.get(card_type, card_type)


def get_provider_display(provider: str | None) -> str | None:
    """Retorna nome amigavel da operadora"""
    if not provider:
        return None
    display_names = {
        BenefitCardProvider.ALELO.value: "Alelo",
        BenefitCardProvider.SODEXO.value: "Sodexo",
        BenefitCardProvider.VR.value: "VR",
        BenefitCardProvider.TICKET.value: "Ticket",
        BenefitCardProvider.FLASH.value: "Flash",
        BenefitCardProvider.IFOOD.value: "iFood Beneficios",
        BenefitCardProvider.CAJU.value: "Caju",
        BenefitCardProvider.SWILE.value: "Swile",
        BenefitCardProvider.PLUXEE.value: "Pluxee",
        BenefitCardProvider.OTHER.value: "Outro",
    }
    return display_names.get(provider, provider)


@router.get("", response_model=list[BenefitCardListResponse])
async def list_benefit_cards(current_user: CurrentUser, db: DbSession):
    """Lista todos os cartoes de beneficio do usuario"""
    household_user_ids = await get_household_user_ids(db, current_user)

    if household_user_ids:
        result = await db.execute(
            select(BenefitCard, Account)
            .join(Account, BenefitCard.account_id == Account.id)
            .where(
                or_(
                    and_(
                        BenefitCard.user_id == current_user.id,
                        Account.ownership_type == "personal"
                    ),
                    and_(
                        BenefitCard.user_id.in_(household_user_ids),
                        Account.ownership_type == "household"
                    )
                )
            )
        )
    else:
        result = await db.execute(
            select(BenefitCard, Account)
            .join(Account, BenefitCard.account_id == Account.id)
            .where(BenefitCard.user_id == current_user.id)
        )

    cards = result.all()

    return [
        BenefitCardListResponse(
            id=card.id,
            account_id=card.account_id,
            name=account.name,
            card_type=card.card_type,
            card_type_display=get_card_type_display(card.card_type),
            provider=card.provider,
            provider_display=get_provider_display(card.provider),
            last_four_digits=card.last_four_digits,
            current_balance=float(account.balance),
            expected_monthly_recharge=float(card.expected_monthly_recharge) if card.expected_monthly_recharge else None,
            recharge_day=card.recharge_day,
            color=account.color,
            icon=account.icon,
            is_active=card.is_active,
        )
        for card, account in cards
    ]


@router.post("", response_model=BenefitCardResponse, status_code=201)
async def create_benefit_card(
    data: BenefitCardCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria um novo cartao de beneficio (cria conta associada automaticamente)"""
    # Validate permission to create with specified ownership_type
    await validate_create_permission(db, current_user, data.ownership_type.value)

    # Create the linked account
    account = Account(
        user_id=current_user.id,
        name=data.name,
        type=AccountType.BENEFIT_CARD.value,
        balance=data.initial_balance,
        currency="BRL",
        color=data.color,
        icon=data.icon,
        ownership_type=data.ownership_type.value,
    )
    db.add(account)
    await db.flush()  # Get account.id

    # Create the benefit card
    benefit_card = BenefitCard(
        account_id=account.id,
        user_id=current_user.id,
        card_type=data.card_type.value,
        provider=data.provider.value if data.provider else None,
        last_four_digits=data.last_four_digits,
        linked_income_source_id=data.linked_income_source_id,
        expected_monthly_recharge=data.expected_monthly_recharge,
        recharge_day=data.recharge_day,
    )
    db.add(benefit_card)
    await db.commit()
    await db.refresh(benefit_card)
    await db.refresh(account)

    return BenefitCardResponse(
        id=benefit_card.id,
        account_id=benefit_card.account_id,
        user_id=benefit_card.user_id,
        card_type=benefit_card.card_type,
        provider=benefit_card.provider,
        last_four_digits=benefit_card.last_four_digits,
        linked_income_source_id=benefit_card.linked_income_source_id,
        expected_monthly_recharge=float(benefit_card.expected_monthly_recharge) if benefit_card.expected_monthly_recharge else None,
        recharge_day=benefit_card.recharge_day,
        is_active=benefit_card.is_active,
        created_at=benefit_card.created_at,
        updated_at=benefit_card.updated_at,
        account_name=account.name,
        account_balance=float(account.balance),
        account_color=account.color,
        account_icon=account.icon,
        card_type_display=get_card_type_display(benefit_card.card_type),
        provider_display=get_provider_display(benefit_card.provider),
    )


@router.get("/{card_id}", response_model=BenefitCardResponse)
async def get_benefit_card(
    card_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna um cartao de beneficio especifico"""
    result = await db.execute(
        select(BenefitCard, Account)
        .join(Account, BenefitCard.account_id == Account.id)
        .where(
            BenefitCard.id == card_id,
            BenefitCard.user_id == current_user.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Cartao de beneficio nao encontrado")

    card, account = row

    return BenefitCardResponse(
        id=card.id,
        account_id=card.account_id,
        user_id=card.user_id,
        card_type=card.card_type,
        provider=card.provider,
        last_four_digits=card.last_four_digits,
        linked_income_source_id=card.linked_income_source_id,
        expected_monthly_recharge=float(card.expected_monthly_recharge) if card.expected_monthly_recharge else None,
        recharge_day=card.recharge_day,
        is_active=card.is_active,
        created_at=card.created_at,
        updated_at=card.updated_at,
        account_name=account.name,
        account_balance=float(account.balance),
        account_color=account.color,
        account_icon=account.icon,
        card_type_display=get_card_type_display(card.card_type),
        provider_display=get_provider_display(card.provider),
    )


@router.patch("/{card_id}", response_model=BenefitCardResponse)
async def update_benefit_card(
    card_id: int,
    data: BenefitCardUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza um cartao de beneficio"""
    result = await db.execute(
        select(BenefitCard, Account)
        .join(Account, BenefitCard.account_id == Account.id)
        .where(
            BenefitCard.id == card_id,
            BenefitCard.user_id == current_user.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Cartao de beneficio nao encontrado")

    card, account = row

    # Update card fields
    card_fields = [
        "card_type", "provider", "last_four_digits",
        "linked_income_source_id", "expected_monthly_recharge",
        "recharge_day", "is_active"
    ]
    account_fields = ["name", "color", "icon"]

    update_data = data.model_dump(exclude_unset=True)

    for field in card_fields:
        if field in update_data:
            value = update_data[field]
            if field == "card_type" and value:
                value = value.value
            if field == "provider" and value:
                value = value.value
            setattr(card, field, value)

    for field in account_fields:
        if field in update_data:
            setattr(account, field, update_data[field])

    # Update account balance if initial_balance is provided
    if "initial_balance" in update_data:
        account.balance = update_data["initial_balance"]

    await db.commit()
    await db.refresh(card)
    await db.refresh(account)

    return BenefitCardResponse(
        id=card.id,
        account_id=card.account_id,
        user_id=card.user_id,
        card_type=card.card_type,
        provider=card.provider,
        last_four_digits=card.last_four_digits,
        linked_income_source_id=card.linked_income_source_id,
        expected_monthly_recharge=float(card.expected_monthly_recharge) if card.expected_monthly_recharge else None,
        recharge_day=card.recharge_day,
        is_active=card.is_active,
        created_at=card.created_at,
        updated_at=card.updated_at,
        account_name=account.name,
        account_balance=float(account.balance),
        account_color=account.color,
        account_icon=account.icon,
        card_type_display=get_card_type_display(card.card_type),
        provider_display=get_provider_display(card.provider),
    )


@router.delete("/{card_id}", status_code=204)
async def delete_benefit_card(
    card_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove um cartao de beneficio (e sua conta associada)"""
    result = await db.execute(
        select(BenefitCard).where(
            BenefitCard.id == card_id,
            BenefitCard.user_id == current_user.id,
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Cartao de beneficio nao encontrado")

    # Delete account (cascades to card)
    account_result = await db.execute(
        select(Account).where(Account.id == card.account_id)
    )
    account = account_result.scalar_one_or_none()

    if account:
        await db.delete(account)
    else:
        await db.delete(card)

    await db.commit()
