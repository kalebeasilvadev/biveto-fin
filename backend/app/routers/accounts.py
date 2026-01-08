from __future__ import annotations
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, or_, and_, func, case
from decimal import Decimal

from ..core.deps import CurrentUser, DbSession
from ..models.account import Account
from ..models.transaction import Transaction, TransactionType
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


async def calculate_account_balance(db, account_id: int) -> Decimal:
    """
    Calcula o saldo real da conta baseado nas transações.
    Saldo = saldo_inicial + receitas - despesas
    """
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.INCOME.value, Transaction.amount),
                        (Transaction.type == TransactionType.EXPENSE.value, -Transaction.amount),
                        else_=0
                    )
                ),
                0
            )
        ).where(Transaction.account_id == account_id)
    )
    return result.scalar() or Decimal(0)


@router.get("", response_model=list[AccountResponse])
async def list_accounts(current_user: CurrentUser, db: DbSession):
    """Lista todas as contas do usuário (pessoais + household) com saldos atualizados"""
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

    accounts = result.scalars().all()

    # Calcular saldo real de cada conta baseado nas transações
    accounts_with_balance = []
    for account in accounts:
        transaction_balance = await calculate_account_balance(db, account.id)
        # O saldo inicial da conta + movimentações das transações
        computed_balance = float(account.balance) + float(transaction_balance)

        # Criar resposta com saldo atualizado
        account_dict = {
            "id": account.id,
            "name": account.name,
            "type": account.type,
            "balance": computed_balance,
            "currency": account.currency,
            "color": account.color,
            "icon": account.icon,
            "is_active": account.is_active,
            "ownership_type": account.ownership_type,
            "created_at": account.created_at,
        }
        accounts_with_balance.append(account_dict)

    return accounts_with_balance


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
    """Retorna uma conta específica com saldo atualizado"""
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")

    # Calcular saldo real baseado nas transações
    transaction_balance = await calculate_account_balance(db, account.id)
    computed_balance = float(account.balance) + float(transaction_balance)

    return {
        "id": account.id,
        "name": account.name,
        "type": account.type,
        "balance": computed_balance,
        "currency": account.currency,
        "color": account.color,
        "icon": account.icon,
        "is_active": account.is_active,
        "ownership_type": account.ownership_type,
        "created_at": account.created_at,
    }


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
