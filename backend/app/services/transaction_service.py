from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from ..models.transaction import Transaction, TransactionAudit, TransactionType
from ..models.merchant import Merchant
from ..models.user import User
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
            type=data.type,
            amount=data.amount,
            currency=data.currency,
            date=data.date,
            description=data.description,
            notes=data.notes,
            tags=data.tags,
            is_fixed=data.is_fixed,
        )
        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

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

            # Verificar idempotência
            existing = await self.db.execute(
                select(Transaction).where(Transaction.document_id == data.document_id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Já existe transação para este documento",
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
                series = await installment_service.find_matching_series(
                    user=user,
                    merchant_name=data.merchant_name or data.description or "Compra",
                    installment_amount=data.amount,
                    installment_total=data.installment_total,
                    account_id=data.account_id,
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
                type=TransactionType.EXPENSE,
                amount=data.amount,
                date=data.date,
                description=data.description,
                tags=data.tags,
                is_fixed=data.is_fixed,
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
        limit: int = 50,
        offset: int = 0,
    ) -> list[Transaction]:
        query = select(Transaction).where(Transaction.user_id == user.id)

        if start_date:
            query = query.where(Transaction.date >= start_date)
        if end_date:
            query = query.where(Transaction.date <= end_date)
        if category_id:
            query = query.where(Transaction.category_id == category_id)
        if account_id:
            query = query.where(Transaction.account_id == account_id)

        query = query.order_by(Transaction.date.desc()).limit(limit).offset(offset)
        result = await self.db.execute(query)
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

        # Registrar alterações para auditoria
        for field, value in data.model_dump(exclude_unset=True).items():
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
