from __future__ import annotations
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import (
    RecurringTransaction, RecurrenceFrequency, RecurringStatus,
    Transaction, User, Account, Category
)
from ..schemas.recurring import RecurringCreate, RecurringUpdate, RecurringResponse, RecurringSummary


class RecurringTransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _calculate_next_due_date(
        self,
        frequency: str,
        start_date: date,
        last_generated: date | None,
        day_of_month: int | None,
        day_of_week: int | None,
    ) -> date:
        """Calcula a próxima data de vencimento"""
        today = date.today()
        base_date = last_generated if last_generated else start_date - timedelta(days=1)

        if frequency == RecurrenceFrequency.DAILY.value:
            next_date = base_date + timedelta(days=1)
        elif frequency == RecurrenceFrequency.WEEKLY.value:
            next_date = base_date + timedelta(weeks=1)
            if day_of_week is not None:
                # Ajustar para o dia da semana correto
                days_ahead = day_of_week - next_date.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                next_date = next_date + timedelta(days=days_ahead)
        elif frequency == RecurrenceFrequency.MONTHLY.value:
            next_date = base_date + relativedelta(months=1)
            if day_of_month:
                # Ajustar para o dia do mês (cuidado com meses com menos dias)
                try:
                    next_date = next_date.replace(day=min(day_of_month, 28))
                except ValueError:
                    next_date = next_date.replace(day=28)
        elif frequency == RecurrenceFrequency.YEARLY.value:
            next_date = base_date + relativedelta(years=1)
        else:
            next_date = base_date + relativedelta(months=1)

        # Se a próxima data já passou, avançar
        while next_date < today:
            if frequency == RecurrenceFrequency.DAILY.value:
                next_date += timedelta(days=1)
            elif frequency == RecurrenceFrequency.WEEKLY.value:
                next_date += timedelta(weeks=1)
            elif frequency == RecurrenceFrequency.MONTHLY.value:
                next_date += relativedelta(months=1)
            elif frequency == RecurrenceFrequency.YEARLY.value:
                next_date += relativedelta(years=1)

        return next_date

    async def create(self, user: User, data: RecurringCreate) -> RecurringTransaction:
        """Cria uma nova transação recorrente"""
        # Verificar se a conta pertence ao usuário
        account = await self.db.scalar(
            select(Account).where(
                Account.id == data.account_id,
                Account.user_id == user.id
            )
        )
        if not account:
            raise ValueError("Conta não encontrada")

        # Verificar categoria se fornecida
        if data.category_id:
            category = await self.db.scalar(
                select(Category).where(
                    Category.id == data.category_id,
                    Category.user_id == user.id
                )
            )
            if not category:
                raise ValueError("Categoria não encontrada")

        # Calcular próxima data
        next_due = self._calculate_next_due_date(
            data.frequency.value,
            data.start_date,
            None,
            data.day_of_month,
            data.day_of_week
        )

        recurring = RecurringTransaction(
            user_id=user.id,
            account_id=data.account_id,
            category_id=data.category_id,
            name=data.name,
            description=data.description,
            amount=data.amount,
            type=data.type.value,
            frequency=data.frequency.value,
            day_of_month=data.day_of_month,
            day_of_week=data.day_of_week,
            start_date=data.start_date,
            end_date=data.end_date,
            next_due_date=next_due,
            status=RecurringStatus.ACTIVE.value,
        )

        self.db.add(recurring)
        await self.db.commit()
        await self.db.refresh(recurring)
        return recurring

    async def list(self, user: User, include_inactive: bool = False) -> list[RecurringResponse]:
        """Lista transações recorrentes do usuário"""
        query = (
            select(RecurringTransaction)
            .options(
                selectinload(RecurringTransaction.account),
                selectinload(RecurringTransaction.category)
            )
            .where(RecurringTransaction.user_id == user.id)
            .order_by(RecurringTransaction.next_due_date)
        )

        if not include_inactive:
            query = query.where(RecurringTransaction.status != RecurringStatus.CANCELLED.value)

        result = await self.db.execute(query)
        items = result.scalars().all()

        return [
            RecurringResponse(
                id=r.id,
                name=r.name,
                description=r.description,
                amount=float(r.amount),
                type=r.type,
                account_id=r.account_id,
                account_name=r.account.name if r.account else None,
                category_id=r.category_id,
                category_name=r.category.name if r.category else None,
                frequency=r.frequency,
                day_of_month=r.day_of_month,
                day_of_week=r.day_of_week,
                start_date=r.start_date,
                end_date=r.end_date,
                status=r.status,
                last_generated_date=r.last_generated_date,
                next_due_date=r.next_due_date,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in items
        ]

    async def get_by_id(self, user: User, recurring_id: int) -> RecurringTransaction | None:
        """Busca uma transação recorrente por ID"""
        result = await self.db.execute(
            select(RecurringTransaction)
            .options(
                selectinload(RecurringTransaction.account),
                selectinload(RecurringTransaction.category)
            )
            .where(
                RecurringTransaction.id == recurring_id,
                RecurringTransaction.user_id == user.id
            )
        )
        return result.scalar_one_or_none()

    async def update(
        self, user: User, recurring_id: int, data: RecurringUpdate
    ) -> RecurringTransaction | None:
        """Atualiza uma transação recorrente"""
        recurring = await self.get_by_id(user, recurring_id)
        if not recurring:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Verificar conta se alterada
        if "account_id" in update_data:
            account = await self.db.scalar(
                select(Account).where(
                    Account.id == update_data["account_id"],
                    Account.user_id == user.id
                )
            )
            if not account:
                raise ValueError("Conta não encontrada")

        # Verificar categoria se alterada
        if "category_id" in update_data and update_data["category_id"]:
            category = await self.db.scalar(
                select(Category).where(
                    Category.id == update_data["category_id"],
                    Category.user_id == user.id
                )
            )
            if not category:
                raise ValueError("Categoria não encontrada")

        # Aplicar atualizações
        for field, value in update_data.items():
            if field == "type" and value:
                setattr(recurring, field, value.value if hasattr(value, 'value') else value)
            elif field == "frequency" and value:
                setattr(recurring, field, value.value if hasattr(value, 'value') else value)
            elif field == "status" and value:
                setattr(recurring, field, value.value if hasattr(value, 'value') else value)
            else:
                setattr(recurring, field, value)

        # Recalcular próxima data se frequência ou dia mudou
        if any(k in update_data for k in ["frequency", "day_of_month", "day_of_week"]):
            recurring.next_due_date = self._calculate_next_due_date(
                recurring.frequency,
                recurring.start_date,
                recurring.last_generated_date,
                recurring.day_of_month,
                recurring.day_of_week,
            )

        await self.db.commit()
        await self.db.refresh(recurring)
        return recurring

    async def delete(self, user: User, recurring_id: int) -> bool:
        """Remove uma transação recorrente"""
        recurring = await self.get_by_id(user, recurring_id)
        if not recurring:
            return False

        await self.db.delete(recurring)
        await self.db.commit()
        return True

    async def pause(self, user: User, recurring_id: int) -> RecurringTransaction | None:
        """Pausa uma transação recorrente"""
        recurring = await self.get_by_id(user, recurring_id)
        if not recurring:
            return None

        recurring.status = RecurringStatus.PAUSED.value
        await self.db.commit()
        await self.db.refresh(recurring)
        return recurring

    async def resume(self, user: User, recurring_id: int) -> RecurringTransaction | None:
        """Retoma uma transação recorrente pausada"""
        recurring = await self.get_by_id(user, recurring_id)
        if not recurring:
            return None

        recurring.status = RecurringStatus.ACTIVE.value
        # Recalcular próxima data
        recurring.next_due_date = self._calculate_next_due_date(
            recurring.frequency,
            recurring.start_date,
            recurring.last_generated_date,
            recurring.day_of_month,
            recurring.day_of_week,
        )
        await self.db.commit()
        await self.db.refresh(recurring)
        return recurring

    async def get_summary(self, user: User) -> RecurringSummary:
        """Retorna resumo das transações recorrentes"""
        result = await self.db.execute(
            select(RecurringTransaction).where(RecurringTransaction.user_id == user.id)
        )
        items = result.scalars().all()

        total_expenses = 0.0
        total_income = 0.0
        active_count = 0
        paused_count = 0

        for r in items:
            if r.status == RecurringStatus.CANCELLED.value:
                continue

            # Calcular valor mensal equivalente
            monthly_amount = float(r.amount)
            if r.frequency == RecurrenceFrequency.DAILY.value:
                monthly_amount *= 30
            elif r.frequency == RecurrenceFrequency.WEEKLY.value:
                monthly_amount *= 4.33
            elif r.frequency == RecurrenceFrequency.YEARLY.value:
                monthly_amount /= 12

            if r.type == "expense":
                total_expenses += monthly_amount
            else:
                total_income += monthly_amount

            if r.status == RecurringStatus.ACTIVE.value:
                active_count += 1
            elif r.status == RecurringStatus.PAUSED.value:
                paused_count += 1

        return RecurringSummary(
            total_monthly_expenses=round(total_expenses, 2),
            total_monthly_income=round(total_income, 2),
            active_count=active_count,
            paused_count=paused_count,
        )

    async def generate_pending_transactions(self, user: User) -> list[Transaction]:
        """Gera transações para recorrências pendentes até hoje"""
        today = date.today()
        generated = []

        result = await self.db.execute(
            select(RecurringTransaction)
            .where(
                RecurringTransaction.user_id == user.id,
                RecurringTransaction.status == RecurringStatus.ACTIVE.value,
                RecurringTransaction.next_due_date <= today,
            )
        )
        pending = result.scalars().all()

        for recurring in pending:
            # Verificar se já passou da data final
            if recurring.end_date and recurring.next_due_date > recurring.end_date:
                recurring.status = RecurringStatus.CANCELLED.value
                continue

            # Criar transação
            transaction = Transaction(
                user_id=user.id,
                account_id=recurring.account_id,
                category_id=recurring.category_id,
                type=recurring.type,
                amount=recurring.amount,
                date=recurring.next_due_date,
                description=recurring.name,
                notes=f"Gerado automaticamente de: {recurring.name}",
                is_recurring=True,
                is_fixed=True,
                recurring_id=recurring.id,
            )
            self.db.add(transaction)
            generated.append(transaction)

            # Atualizar recorrência
            recurring.last_generated_date = recurring.next_due_date
            recurring.next_due_date = self._calculate_next_due_date(
                recurring.frequency,
                recurring.start_date,
                recurring.last_generated_date,
                recurring.day_of_month,
                recurring.day_of_week,
            )

        await self.db.commit()
        return generated
