"""
Serviço de Orçamento (Budget)
Implementa funcionalidades baseadas em YNAB e Dave Ramsey
"""
from datetime import date
from decimal import Decimal
from calendar import monthrange
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException, status

from app.models.budget import Budget, BudgetItem
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.models.user import User
from app.modules.budgets.schemas.budget import (
    BudgetCreate, BudgetUpdate, BudgetItemCreate, BudgetItemUpdate,
    BudgetResponse, BudgetItemResponse, BudgetSummary, BudgetComparisonResponse
)


class BudgetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_budget(self, user: User, year: int, month: int) -> Budget:
        """Obtém ou cria orçamento para o mês"""
        result = await self.db.execute(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.year == year,
                Budget.month == month
            )
        )
        budget = result.scalar_one_or_none()

        if not budget:
            budget = Budget(
                user_id=user.id,
                year=year,
                month=month
            )
            self.db.add(budget)
            await self.db.flush()
            await self.db.refresh(budget)

        return budget

    async def get_budget(self, user: User, year: int, month: int) -> BudgetResponse | None:
        """Retorna orçamento com gastos calculados"""
        budget = await self.get_or_create_budget(user, year, month)

        # Calcular gastos reais por categoria
        start_date = date(year, month, 1)
        _, last_day = monthrange(year, month)
        end_date = date(year, month, last_day)

        # Buscar transações do mês
        expenses_by_category = await self._get_expenses_by_category(
            user, start_date, end_date
        )
        total_income = await self._get_total_income(user, start_date, end_date)
        total_spent = sum(expenses_by_category.values())

        # Buscar nomes de todas as categorias de uma vez
        category_ids = [item.category_id for item in budget.items if item.category_id]
        category_names = {}
        if category_ids:
            cat_result = await self.db.execute(
                select(Category.id, Category.name).where(Category.id.in_(category_ids))
            )
            category_names = {row[0]: row[1] for row in cat_result.all()}

        # Montar itens com valores calculados
        items_response = []
        for item in budget.items:
            spent = expenses_by_category.get(item.category_id, Decimal(0))
            available = item.planned_amount + item.rollover_amount - spent

            items_response.append(BudgetItemResponse(
                id=item.id,
                budget_id=item.budget_id,
                category_id=item.category_id,
                planned_amount=item.planned_amount,
                rollover_amount=item.rollover_amount,
                is_fixed=item.is_fixed,
                priority=item.priority,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
                spent_amount=spent,
                available_amount=available,
                percentage_used=float(spent / item.planned_amount * 100) if item.planned_amount > 0 else 0,
                category_name=category_names.get(item.category_id)
            ))

        total_planned = sum(item.planned_amount for item in budget.items)
        total_available = sum(i.available_amount for i in items_response)

        # Calcular score de saúde (0-100)
        health_score = self._calculate_health_score(
            total_planned, total_spent, budget.total_income_planned, total_income
        )

        return BudgetResponse(
            id=budget.id,
            user_id=budget.user_id,
            year=budget.year,
            month=budget.month,
            total_income_planned=budget.total_income_planned,
            total_expense_planned=total_planned,
            allow_rollover=budget.allow_rollover,
            notes=budget.notes,
            created_at=budget.created_at,
            updated_at=budget.updated_at,
            items=items_response,
            total_spent=total_spent,
            total_available=total_available,
            total_income_actual=total_income,
            balance=total_income - total_spent,
            health_score=health_score
        )

    async def create_budget(self, user: User, data: BudgetCreate) -> Budget:
        """Cria orçamento com itens"""
        # Verificar se já existe
        existing = await self.db.execute(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.year == data.year,
                Budget.month == data.month
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Já existe orçamento para {data.month}/{data.year}"
            )

        budget = Budget(
            user_id=user.id,
            year=data.year,
            month=data.month,
            total_income_planned=data.total_income_planned,
            allow_rollover=data.allow_rollover,
            notes=data.notes
        )
        self.db.add(budget)
        await self.db.flush()

        # Adicionar itens
        total_expense = Decimal(0)
        for item_data in data.items:
            item = BudgetItem(
                budget_id=budget.id,
                category_id=item_data.category_id,
                planned_amount=item_data.planned_amount,
                is_fixed=item_data.is_fixed,
                priority=item_data.priority,
                notes=item_data.notes
            )
            self.db.add(item)
            total_expense += item_data.planned_amount

        budget.total_expense_planned = total_expense
        await self.db.flush()
        await self.db.refresh(budget)

        return budget

    async def update_budget(self, user: User, year: int, month: int, data: BudgetUpdate) -> Budget:
        """Atualiza orçamento"""
        budget = await self.get_or_create_budget(user, year, month)

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(budget, field, value)

        await self.db.flush()
        await self.db.refresh(budget)
        return budget

    async def add_budget_item(self, user: User, year: int, month: int, data: BudgetItemCreate) -> BudgetItem:
        """Adiciona item ao orçamento"""
        budget = await self.get_or_create_budget(user, year, month)

        # Verificar se categoria já existe no orçamento
        existing = await self.db.execute(
            select(BudgetItem).where(
                BudgetItem.budget_id == budget.id,
                BudgetItem.category_id == data.category_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Categoria já existe neste orçamento"
            )

        item = BudgetItem(
            budget_id=budget.id,
            category_id=data.category_id,
            planned_amount=data.planned_amount,
            is_fixed=data.is_fixed,
            priority=data.priority,
            notes=data.notes
        )
        self.db.add(item)

        # Atualizar total do orçamento
        budget.total_expense_planned += data.planned_amount

        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update_budget_item(self, user: User, item_id: int, data: BudgetItemUpdate) -> BudgetItem:
        """Atualiza item do orçamento"""
        result = await self.db.execute(
            select(BudgetItem).join(Budget).where(
                BudgetItem.id == item_id,
                Budget.user_id == user.id
            )
        )
        item = result.scalar_one_or_none()

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item não encontrado"
            )

        old_amount = item.planned_amount

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)

        # Atualizar total do orçamento se valor mudou
        if data.planned_amount is not None and data.planned_amount != old_amount:
            budget_result = await self.db.execute(
                select(Budget).where(Budget.id == item.budget_id)
            )
            budget = budget_result.scalar_one()
            budget.total_expense_planned += (data.planned_amount - old_amount)

        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def delete_budget_item(self, user: User, item_id: int) -> None:
        """Remove item do orçamento"""
        result = await self.db.execute(
            select(BudgetItem).join(Budget).where(
                BudgetItem.id == item_id,
                Budget.user_id == user.id
            )
        )
        item = result.scalar_one_or_none()

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item não encontrado"
            )

        # Atualizar total do orçamento
        budget_result = await self.db.execute(
            select(Budget).where(Budget.id == item.budget_id)
        )
        budget = budget_result.scalar_one()
        budget.total_expense_planned -= item.planned_amount

        await self.db.delete(item)

    async def copy_budget(self, user: User, target_year: int, target_month: int,
                          source_year: int, source_month: int, include_rollover: bool = True) -> Budget:
        """Copia orçamento de outro mês"""
        # Buscar orçamento fonte
        source_result = await self.db.execute(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.year == source_year,
                Budget.month == source_month
            )
        )
        source = source_result.scalar_one_or_none()

        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Orçamento de {source_month}/{source_year} não encontrado"
            )

        # Verificar se já existe orçamento destino
        existing = await self.db.execute(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.year == target_year,
                Budget.month == target_month
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Já existe orçamento para {target_month}/{target_year}"
            )

        # Criar novo orçamento
        new_budget = Budget(
            user_id=user.id,
            year=target_year,
            month=target_month,
            total_income_planned=source.total_income_planned,
            total_expense_planned=source.total_expense_planned,
            allow_rollover=source.allow_rollover
        )
        self.db.add(new_budget)
        await self.db.flush()

        # Copiar itens
        for source_item in source.items:
            # Calcular rollover se solicitado
            rollover = Decimal(0)
            if include_rollover and source.allow_rollover:
                # Buscar gasto real da categoria no mês fonte
                start_date = date(source_year, source_month, 1)
                _, last_day = monthrange(source_year, source_month)
                end_date = date(source_year, source_month, last_day)

                expenses = await self._get_expenses_by_category(user, start_date, end_date)
                spent = expenses.get(source_item.category_id, Decimal(0))
                available = source_item.planned_amount + source_item.rollover_amount - spent
                rollover = max(Decimal(0), available)  # Só rola saldo positivo

            new_item = BudgetItem(
                budget_id=new_budget.id,
                category_id=source_item.category_id,
                planned_amount=source_item.planned_amount,
                rollover_amount=rollover,
                is_fixed=source_item.is_fixed,
                priority=source_item.priority,
                notes=source_item.notes
            )
            self.db.add(new_item)

        await self.db.flush()
        await self.db.refresh(new_budget)
        return new_budget

    async def get_summary(self, user: User, year: int, month: int) -> BudgetSummary:
        """Retorna resumo do orçamento para dashboard"""
        budget_response = await self.get_budget(user, year, month)

        if not budget_response:
            return BudgetSummary(
                year=year,
                month=month,
                total_planned=Decimal(0),
                total_spent=Decimal(0),
                total_available=Decimal(0),
                percentage_used=0,
                days_remaining=0,
                daily_budget_remaining=Decimal(0),
                categories_over_budget=0,
                categories_on_track=0
            )

        # Calcular dias restantes no mês
        today = date.today()
        _, last_day = monthrange(year, month)
        if today.year == year and today.month == month:
            days_remaining = last_day - today.day
        elif date(year, month, 1) > today:
            days_remaining = last_day
        else:
            days_remaining = 0

        # Calcular orçamento diário restante
        daily_remaining = Decimal(0)
        if days_remaining > 0 and budget_response.total_available > 0:
            daily_remaining = budget_response.total_available / days_remaining

        # Contar categorias
        over_budget = sum(1 for i in budget_response.items if i.available_amount < 0)
        on_track = sum(1 for i in budget_response.items if i.available_amount >= 0)

        percentage_used = 0.0
        if budget_response.total_expense_planned > 0:
            percentage_used = float(
                budget_response.total_spent / budget_response.total_expense_planned * 100
            )

        return BudgetSummary(
            year=year,
            month=month,
            total_planned=budget_response.total_expense_planned,
            total_spent=budget_response.total_spent,
            total_available=budget_response.total_available,
            percentage_used=percentage_used,
            days_remaining=days_remaining,
            daily_budget_remaining=daily_remaining,
            categories_over_budget=over_budget,
            categories_on_track=on_track
        )

    async def get_comparison(self, user: User, year: int, month: int) -> list[BudgetComparisonResponse]:
        """Compara orçamento planejado vs realizado por categoria"""
        budget_response = await self.get_budget(user, year, month)

        comparisons = []
        for item in budget_response.items:
            difference = item.planned_amount - item.spent_amount

            if item.spent_amount > item.planned_amount:
                item_status = "over"
            elif item.spent_amount < item.planned_amount * Decimal("0.8"):
                item_status = "under"
            else:
                item_status = "on_track"

            comparisons.append(BudgetComparisonResponse(
                category_id=item.category_id,
                category_name=item.category_name or "",
                planned=item.planned_amount,
                actual=item.spent_amount,
                difference=difference,
                percentage=item.percentage_used,
                status=item_status
            ))

        return sorted(comparisons, key=lambda x: x.actual, reverse=True)

    async def _get_expenses_by_category(self, user: User, start_date: date, end_date: date) -> dict[int, Decimal]:
        """Retorna gastos por categoria no período"""
        result = await self.db.execute(
            select(
                Transaction.category_id,
                func.sum(Transaction.amount).label('total')
            ).where(
                Transaction.user_id == user.id,
                Transaction.type == TransactionType.EXPENSE.value,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                Transaction.category_id.isnot(None)
            ).group_by(Transaction.category_id)
        )

        return {row.category_id: row.total for row in result.all()}

    async def _get_total_income(self, user: User, start_date: date, end_date: date) -> Decimal:
        """Retorna total de receitas no período"""
        result = await self.db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.user_id == user.id,
                Transaction.type == TransactionType.INCOME.value,
                Transaction.date >= start_date,
                Transaction.date <= end_date
            )
        )
        return result.scalar() or Decimal(0)

    def _calculate_health_score(self, planned: Decimal, spent: Decimal,
                                 income_planned: Decimal, income_actual: Decimal) -> float:
        """
        Calcula score de saúde do orçamento (0-100)
        Considera: aderência ao planejado, margem, e receita vs despesa
        """
        if planned == 0:
            return 50.0

        score = 100.0

        # Penalizar se gastou mais que o planejado
        if spent > planned:
            overspend_pct = float((spent - planned) / planned * 100)
            score -= min(40, overspend_pct)

        # Penalizar se gastou mais que a receita
        if income_actual > 0 and spent > income_actual:
            deficit_pct = float((spent - income_actual) / income_actual * 100)
            score -= min(30, deficit_pct)

        # Bônus se receita superou o esperado
        if income_planned > 0 and income_actual > income_planned:
            bonus = min(10, float((income_actual - income_planned) / income_planned * 100))
            score += bonus

        return max(0, min(100, score))
