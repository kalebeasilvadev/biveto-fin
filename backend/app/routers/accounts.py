from __future__ import annotations
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, or_, and_

from ..core.deps import CurrentUser, DbSession
from ..models.account import Account
from ..models.household import HouseholdMember
from ..schemas.account import AccountCreate, AccountResponse, AccountUpdate

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


@router.get("", response_model=list[AccountResponse])
async def list_accounts(current_user: CurrentUser, db: DbSession):
    """Lista todas as contas do usuário (pessoais + household)"""
    household_user_ids = await get_household_user_ids(db, current_user)

    if household_user_ids:
        # User is in a household - get personal + household accounts
        result = await db.execute(
            select(Account).where(
                or_(
                    # Personal accounts from user
                    and_(
                        Account.user_id == current_user.id,
                        Account.ownership_type == "personal"
                    ),
                    # Household accounts from any family member
                    and_(
                        Account.user_id.in_(household_user_ids),
                        Account.ownership_type == "household"
                    )
                )
            )
        )
    else:
        result = await db.execute(
            select(Account).where(Account.user_id == current_user.id)
        )
    return result.scalars().all()


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    data: AccountCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma nova conta"""
    account = Account(
        user_id=current_user.id,
        name=data.name,
        type=data.type,
        balance=data.balance,
        currency=data.currency,
        color=data.color,
        icon=data.icon,
        ownership_type=data.ownership_type.value,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna uma conta específica"""
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    data: AccountUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza uma conta"""
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)

    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove uma conta"""
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")

    await db.delete(account)
    await db.commit()
