"""
Serviço para geração automática de transações a partir de fontes de receita.
Cria transações no histórico para receitas recorrentes (salário, benefícios, etc).
"""
from datetime import date
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.income_source import IncomeSource, IncomeFrequency
from ..models.transaction import Transaction, TransactionType
from .business_day_service import get_payment_date_for_income


class IncomeTransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_income_transactions(
        self,
        user_id: int,
        year: int,
        month: int,
        overwrite: bool = False
    ) -> List[Transaction]:
        """
        Gera transações para todas as fontes de receita ativas de um usuário
        para um determinado mês.

        Args:
            user_id: ID do usuário
            year: Ano
            month: Mês (1-12)
            overwrite: Se True, recria transações mesmo se já existirem

        Returns:
            Lista de transações criadas
        """
        # Buscar fontes de receita ativas do usuário
        result = await self.db.execute(
            select(IncomeSource).where(
                and_(
                    IncomeSource.user_id == user_id,
                    IncomeSource.is_active == True,
                    IncomeSource.frequency.in_([
                        IncomeFrequency.MONTHLY.value,
                        IncomeFrequency.BIWEEKLY.value,
                        IncomeFrequency.WEEKLY.value,
                    ])
                )
            )
        )
        sources = result.scalars().all()

        created_transactions = []

        for source in sources:
            transactions = await self._generate_for_source(
                source, year, month, overwrite
            )
            created_transactions.extend(transactions)

        await self.db.commit()
        return created_transactions

    async def _generate_for_source(
        self,
        source: IncomeSource,
        year: int,
        month: int,
        overwrite: bool
    ) -> List[Transaction]:
        """
        Gera transações para uma fonte de receita específica.
        """
        transactions = []

        if source.frequency == IncomeFrequency.MONTHLY.value:
            # Receita mensal - uma transação por mês
            payment_date = get_payment_date_for_income(
                year, month,
                source.payment_day,
                source.use_business_day,
                source.business_day_number
            )

            transaction = await self._create_transaction_if_not_exists(
                source, payment_date, overwrite
            )
            if transaction:
                transactions.append(transaction)

        elif source.frequency == IncomeFrequency.BIWEEKLY.value:
            # Receita quinzenal - duas transações por mês
            # Primeiro pagamento no dia configurado
            # Segundo pagamento 15 dias depois (ou ajustado para o mês seguinte)
            first_date = get_payment_date_for_income(
                year, month,
                source.payment_day,
                source.use_business_day,
                source.business_day_number
            )
            t1 = await self._create_transaction_if_not_exists(source, first_date, overwrite)
            if t1:
                transactions.append(t1)

            # Segunda data (15 dias depois, ajustado se necessário)
            from calendar import monthrange
            if source.payment_day:
                second_day = source.payment_day + 15
                last_day = monthrange(year, month)[1]
                if second_day <= last_day:
                    second_date = date(year, month, second_day)
                    t2 = await self._create_transaction_if_not_exists(source, second_date, overwrite)
                    if t2:
                        transactions.append(t2)

        elif source.frequency == IncomeFrequency.WEEKLY.value:
            # Receita semanal - ~4 transações por mês
            from calendar import monthrange
            last_day = monthrange(year, month)[1]
            current_date = date(year, month, source.payment_day or 1)

            while current_date.month == month:
                t = await self._create_transaction_if_not_exists(source, current_date, overwrite)
                if t:
                    transactions.append(t)
                current_date = date(
                    current_date.year,
                    current_date.month,
                    min(current_date.day + 7, last_day)
                )
                if current_date.day + 7 > last_day and current_date.day != last_day:
                    break

        return transactions

    async def _create_transaction_if_not_exists(
        self,
        source: IncomeSource,
        payment_date: date,
        overwrite: bool
    ) -> Optional[Transaction]:
        """
        Cria uma transação se não existir uma para a mesma fonte e data.
        """
        # Verificar se já existe transação para esta fonte e data
        existing = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.income_source_id == source.id,
                    Transaction.date == payment_date
                )
            )
        )
        existing_transaction = existing.scalar_one_or_none()

        if existing_transaction:
            if overwrite:
                # Atualizar transação existente
                existing_transaction.amount = source.expected_amount or 0
                existing_transaction.description = f"{source.name} (atualizado)"
                return existing_transaction
            else:
                # Já existe e não deve sobrescrever
                return None

        # Criar nova transação
        # Description includes source company name for clarity
        description = source.name
        if source.source_name:
            description = f"{source.name} - {source.source_name}"

        transaction = Transaction(
            user_id=source.user_id,
            account_id=source.account_id,
            category_id=source.category_id,
            income_source_id=source.id,
            type=TransactionType.INCOME.value,
            amount=source.expected_amount or 0,
            date=payment_date,
            description=description,
            ownership_type=source.ownership_type,
        )
        self.db.add(transaction)

        return transaction

    async def generate_for_specific_source(
        self,
        source_id: int,
        user_id: int,
        year: int,
        month: int,
        overwrite: bool = False
    ) -> List[Transaction]:
        """
        Gera transações para uma fonte de receita específica.
        """
        result = await self.db.execute(
            select(IncomeSource).where(
                and_(
                    IncomeSource.id == source_id,
                    IncomeSource.user_id == user_id,
                    IncomeSource.is_active == True
                )
            )
        )
        source = result.scalar_one_or_none()

        if not source:
            return []

        transactions = await self._generate_for_source(source, year, month, overwrite)
        await self.db.commit()
        return transactions

    async def preview_transactions(
        self,
        user_id: int,
        year: int,
        month: int
    ) -> List[dict]:
        """
        Retorna uma prévia das transações que seriam criadas,
        sem realmente criar no banco.
        """
        result = await self.db.execute(
            select(IncomeSource).where(
                and_(
                    IncomeSource.user_id == user_id,
                    IncomeSource.is_active == True,
                    IncomeSource.frequency.in_([
                        IncomeFrequency.MONTHLY.value,
                        IncomeFrequency.BIWEEKLY.value,
                        IncomeFrequency.WEEKLY.value,
                    ])
                )
            )
        )
        sources = result.scalars().all()

        preview = []
        for source in sources:
            if source.frequency == IncomeFrequency.MONTHLY.value:
                payment_date = get_payment_date_for_income(
                    year, month,
                    source.payment_day,
                    source.use_business_day,
                    source.business_day_number
                )
                preview.append({
                    "source_id": source.id,
                    "source_name": source.name,
                    "type": source.type,
                    "amount": float(source.expected_amount) if source.expected_amount else 0,
                    "date": payment_date.isoformat(),
                    "is_business_day": source.use_business_day,
                    "business_day_number": source.business_day_number,
                })

        return preview
