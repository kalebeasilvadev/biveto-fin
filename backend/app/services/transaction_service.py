from __future__ import annotations
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from fastapi import HTTPException, status

from ..models.transaction import Transaction, TransactionAudit, TransactionType
from ..models.merchant import Merchant
from ..models.account import Account
from ..models.user import User
from ..models.household import HouseholdMember
from ..models.recurring import RecurringTransaction
from ..schemas.transaction import TransactionCreate, TransactionUpdate, TransactionConfirm
from .installment_service import InstallmentService


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user: User, data: TransactionCreate) -> Transaction:
        merchant_id = None
        if data.merchant_name:
            merchant_id = await self._get_or_create_merchant(data.merchant_name)

        transaction = Transaction(
            user_id=user.id,
            account_id=data.account_id,
            category_id=data.category_id,
            merchant_id=merchant_id,
            credit_card_id=getattr(data, 'credit_card_id', None),
            income_source_id=getattr(data, 'income_source_id', None),
            type=data.type,
            amount=data.amount,
            currency=data.currency,
            date=data.date,
            description=data.description,
            notes=data.notes,
            tags=data.tags,
            is_fixed=data.is_fixed,
            ownership_type=data.ownership_type.value if hasattr(data.ownership_type, 'value') else data.ownership_type,
        )
        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)

        # Criar recorrência se solicitado
        if data.create_recurring and data.recurring_frequency:
            await self._create_recurring_from_transaction(user, data, transaction)

        return transaction

    async def _create_recurring_from_transaction(
        self, user: User, data: TransactionCreate, transaction: Transaction
    ) -> RecurringTransaction:
        """Cria uma transação recorrente baseada em uma transação criada"""
        # Verificar se já existe recorrência similar
        existing = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user.id,
                RecurringTransaction.name == (data.description or data.merchant_name or "Recorrente"),
                RecurringTransaction.amount == data.amount,
                RecurringTransaction.status == "active",
            )
        )
        if existing.scalar_one_or_none():
            return None  # Já existe, não criar duplicata

        # Determinar dia do mês ou semana
        day_of_month = data.recurring_day_of_month
        day_of_week = data.recurring_day_of_week

        if data.recurring_frequency == "monthly" and not day_of_month:
            day_of_month = data.date.day  # Usar o dia da transação

        if data.recurring_frequency == "weekly" and day_of_week is None:
            day_of_week = data.date.weekday()  # Usar o dia da semana da transação

        recurring = RecurringTransaction(
            user_id=user.id,
            name=data.description or data.merchant_name or "Recorrente",
            description=data.notes,
            amount=data.amount,
            type=data.type.value if hasattr(data.type, 'value') else data.type,
            account_id=data.account_id,
            category_id=data.category_id,
            frequency=data.recurring_frequency,
            day_of_month=day_of_month,
            day_of_week=day_of_week,
            start_date=data.date,
            status="active",
            last_generated_date=data.date,  # Já foi gerada (a transação atual)
        )
        self.db.add(recurring)
        await self.db.flush()
        return recurring

    async def confirm_from_document(
        self, user: User, data: TransactionConfirm
    ) -> dict:
        """
        Cria transação confirmando dados de documento processado.

        Retorna dict com:
        - transaction: Transação criada
        - series: Série de parcelas (se aplicável)
        - created_transactions: Transações adicionais criadas (parcelas anteriores/futuras)
        """
        from ..models.document import Document

        # Verificar documento se fornecido
        if data.document_id:
            result = await self.db.execute(
                select(Document).where(
                    Document.id == data.document_id,
                    Document.user_id == user.id,
                )
            )
            document = result.scalar_one_or_none()

            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Documento não encontrado",
                )

            # Verificar idempotência por item específico (document_id + merchant_name + amount)
            # Permite múltiplos itens do mesmo documento, mas não duplicatas exatas
            if data.merchant_name:
                existing = await self.db.execute(
                    select(Transaction).where(
                        Transaction.document_id == data.document_id,
                        Transaction.description == data.merchant_name,
                        Transaction.amount == data.amount,
                    )
                )
                if existing.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Item já adicionado: {data.merchant_name}",
                    )

        merchant_id = None
        if data.merchant_name:
            merchant_id = await self._get_or_create_merchant(data.merchant_name)

        result = {
            "transaction": None,
            "series": None,
            "created_transactions": [],
        }

        # Se é uma transação parcelada
        if data.is_installment and data.installment_current and data.installment_total:
            installment_service = InstallmentService(self.db)

            # Verificar se série já existe ou criar nova
            series = None
            if data.installment_series_id:
                series = await installment_service.get_series_by_id(
                    user, data.installment_series_id
                )
                if not series:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Série de parcelas não encontrada",
                    )
            else:
                # Tentar encontrar série existente
                # Passa a data e número da parcela para validação de compatibilidade
                series = await installment_service.find_matching_series(
                    user=user,
                    merchant_name=data.merchant_name or data.description or "Compra",
                    installment_amount=data.amount,
                    installment_total=data.installment_total,
                    account_id=data.account_id,
                    transaction_date=data.date,
                    installment_number=data.installment_current,
                )

            # Se não encontrou, criar nova série
            if not series:
                series = await installment_service.create_series(
                    user=user,
                    description=data.description or data.merchant_name or "Compra parcelada",
                    merchant_name=data.merchant_name or data.description or "Compra",
                    installment_amount=data.amount,
                    installment_count=data.installment_total,
                    first_installment_date=data.date,
                    account_id=data.account_id,
                    category_id=data.category_id,
                )

            result["series"] = series

            # Se solicitado, marcar parcelas anteriores como pagas
            if data.mark_previous_as_paid and data.installment_current > 1:
                previous_transactions = await installment_service.mark_previous_installments_as_paid(
                    user=user,
                    series=series,
                    up_to_installment=data.installment_current,
                )
                result["created_transactions"].extend(previous_transactions)

            # Criar transação da parcela atual
            transaction = await installment_service.create_installment_transaction(
                user=user,
                series=series,
                installment_number=data.installment_current,
                transaction_date=data.date,
                is_paid=True,
                document_id=data.document_id,
            )

            result["transaction"] = transaction

            # Se solicitado, criar parcelas futuras
            if data.create_future_installments:
                future_transactions = await installment_service.create_future_installments(
                    user=user,
                    series=series,
                    from_installment=data.installment_current,
                )
                result["created_transactions"].extend(future_transactions)

        else:
            # Transação simples (não parcelada)
            transaction = Transaction(
                user_id=user.id,
                account_id=data.account_id,
                document_id=data.document_id,
                category_id=data.category_id,
                merchant_id=merchant_id,
                credit_card_id=getattr(data, 'credit_card_id', None),
                income_source_id=getattr(data, 'income_source_id', None),
                type=TransactionType.EXPENSE,
                amount=data.amount,
                date=data.date,
                description=data.description,
                tags=data.tags,
                is_fixed=data.is_fixed,
                ownership_type=data.ownership_type.value if hasattr(data.ownership_type, 'value') else data.ownership_type,
            )
            self.db.add(transaction)
            await self.db.flush()
            await self.db.refresh(transaction)
            result["transaction"] = transaction

        return result

    async def get_by_id(self, user: User, transaction_id: int) -> Transaction | None:
        result = await self.db.execute(
            select(Transaction).where(
                Transaction.id == transaction_id,
                Transaction.user_id == user.id,
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        user: User,
        start_date: date | None = None,
        end_date: date | None = None,
        category_id: int | None = None,
        account_id: int | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Transaction]:
        from ..models.category import Category

        # Get household member IDs if user is part of a household
        household_user_ids = await self._get_household_user_ids(user)

        if household_user_ids:
            # User is in a household - get personal + household transactions
            query = select(Transaction).where(
                or_(
                    # Personal transactions from user
                    and_(
                        Transaction.user_id == user.id,
                        Transaction.ownership_type == "personal"
                    ),
                    # Household transactions from any family member
                    and_(
                        Transaction.user_id.in_(household_user_ids),
                        Transaction.ownership_type == "household"
                    )
                )
            )
        else:
            query = select(Transaction).where(Transaction.user_id == user.id)

        if start_date:
            query = query.where(Transaction.date >= start_date)
        if end_date:
            query = query.where(Transaction.date <= end_date)
        if category_id:
            query = query.where(Transaction.category_id == category_id)
        if account_id:
            query = query.where(Transaction.account_id == account_id)

        # Search across description, merchant name, and category name
        if search:
            search_term = f"%{search.lower()}%"
            query = query.outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
            query = query.outerjoin(Category, Transaction.category_id == Category.id)
            query = query.where(
                or_(
                    func.lower(Transaction.description).like(search_term),
                    func.lower(Merchant.name).like(search_term),
                    func.lower(Category.name).like(search_term),
                )
            )

        query = query.order_by(Transaction.date.desc()).limit(limit).offset(offset)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(
        self,
        user: User,
        start_date: date | None = None,
        end_date: date | None = None,
        category_id: int | None = None,
        account_id: int | None = None,
        search: str | None = None,
    ) -> int:
        """Returns the total count of transactions matching the filters"""
        from ..models.category import Category

        household_user_ids = await self._get_household_user_ids(user)

        if household_user_ids:
            query = select(func.count(Transaction.id)).where(
                or_(
                    and_(
                        Transaction.user_id == user.id,
                        Transaction.ownership_type == "personal"
                    ),
                    and_(
                        Transaction.user_id.in_(household_user_ids),
                        Transaction.ownership_type == "household"
                    )
                )
            )
        else:
            query = select(func.count(Transaction.id)).where(Transaction.user_id == user.id)

        if start_date:
            query = query.where(Transaction.date >= start_date)
        if end_date:
            query = query.where(Transaction.date <= end_date)
        if category_id:
            query = query.where(Transaction.category_id == category_id)
        if account_id:
            query = query.where(Transaction.account_id == account_id)

        # Search across description, merchant name, and category name
        if search:
            search_term = f"%{search.lower()}%"
            query = query.outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
            query = query.outerjoin(Category, Transaction.category_id == Category.id)
            query = query.where(
                or_(
                    func.lower(Transaction.description).like(search_term),
                    func.lower(Merchant.name).like(search_term),
                    func.lower(Category.name).like(search_term),
                )
            )

        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _get_household_user_ids(self, user: User) -> list[int]:
        """Get all user IDs in the same household/license as the user"""
        if not user.license_id:
            return []

        result = await self.db.execute(
            select(HouseholdMember.user_id).where(
                HouseholdMember.license_id == user.license_id
            )
        )
        return list(result.scalars().all())

    async def update(
        self, user: User, transaction_id: int, data: TransactionUpdate
    ) -> Transaction:
        transaction = await self.get_by_id(user, transaction_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transação não encontrada",
            )

        update_data = data.model_dump(exclude_unset=True)

        # Handle special field: merchant_name -> merchant_id
        if "merchant_name" in update_data:
            merchant_name = update_data.pop("merchant_name")
            if merchant_name:
                merchant_id = await self._get_or_create_merchant(merchant_name)
                update_data["merchant_id"] = merchant_id
            else:
                update_data["merchant_id"] = None

        # Handle special field: account_id - validate ownership
        if "account_id" in update_data:
            account_id = update_data["account_id"]
            household_ids = await self._get_household_user_ids(user)
            if household_ids:
                result = await self.db.execute(
                    select(Account).where(
                        Account.id == account_id,
                        or_(
                            and_(Account.user_id == user.id, Account.ownership_type == "personal"),
                            and_(Account.user_id.in_(household_ids), Account.ownership_type == "household")
                        )
                    )
                )
            else:
                result = await self.db.execute(
                    select(Account).where(Account.id == account_id, Account.user_id == user.id)
                )
            if not result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Conta não encontrada")

        # Handle enum field: type
        if "type" in update_data and update_data["type"]:
            update_data["type"] = update_data["type"].value

        # Registrar alterações para auditoria
        for field, value in update_data.items():
            old_value = getattr(transaction, field)
            if old_value != value:
                audit = TransactionAudit(
                    transaction_id=transaction.id,
                    field_name=field,
                    old_value=str(old_value) if old_value else None,
                    new_value=str(value) if value else None,
                    reason="manual",
                )
                self.db.add(audit)
                setattr(transaction, field, value)

        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

    async def delete(self, user: User, transaction_id: int) -> None:
        transaction = await self.get_by_id(user, transaction_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transação não encontrada",
            )
        await self.db.delete(transaction)

    async def _get_or_create_merchant(self, name: str) -> int:
        normalized = name.lower().strip()
        result = await self.db.execute(
            select(Merchant).where(Merchant.normalized_name == normalized)
        )
        merchant = result.scalar_one_or_none()

        if not merchant:
            merchant = Merchant(name=name, normalized_name=normalized)
            self.db.add(merchant)
            await self.db.flush()

        return merchant.id
