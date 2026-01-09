from __future__ import annotations
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from calendar import monthrange

from ..models.transaction import Transaction, TransactionType
from ..models.category import Category
from ..models.merchant import Merchant
from ..models.user import User
from ..models.household import HouseholdMember
from ..models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from ..schemas.analytics import (
    AnalyticsSummary,
    CategorySummary,
    MerchantSummary,
    InsightResponse,
)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_monthly_summary(
        self, user: User, year: int, month: int
    ) -> AnalyticsSummary:
        # Calcular período
        _, last_day = monthrange(year, month)
        period_start = date(year, month, 1)
        period_end = date(year, month, last_day)

        # Buscar transações do período
        transactions = await self._get_transactions(user, period_start, period_end)

        # Buscar IDs de transações de pagamento de fatura para excluir
        # (evita contagem dupla: contamos as compras do cartão, não o pagamento da fatura)
        try:
            payment_transaction_ids = await self._get_invoice_payment_transaction_ids(user)
        except Exception:
            payment_transaction_ids = set()

        # Calcular totais (converter para float para evitar problemas com Decimal)
        total_income = float(sum(
            t.amount for t in transactions if t.type == TransactionType.INCOME
        ) or 0)
        # Excluir transações de pagamento de fatura para evitar contagem dupla
        total_expense = float(sum(
            t.amount for t in transactions
            if t.type == TransactionType.EXPENSE and t.id not in payment_transaction_ids
        ) or 0)

        fixed_expenses = float(sum(
            t.amount
            for t in transactions
            if t.type == TransactionType.EXPENSE and t.is_fixed and t.id not in payment_transaction_ids
        ) or 0)
        variable_expenses = total_expense - fixed_expenses

        # Agrupar por categoria (excluindo pagamentos de fatura)
        categories = await self._group_by_category(transactions, payment_transaction_ids)

        # Top merchants (excluindo pagamentos de fatura)
        top_merchants = await self._group_by_merchant(transactions, payment_transaction_ids)

        # Período anterior para comparação
        prev_start = period_start - timedelta(days=period_start.day)
        prev_end = period_start - timedelta(days=1)
        prev_transactions = await self._get_transactions(user, prev_start, prev_end)
        prev_expense = float(sum(
            t.amount for t in prev_transactions
            if t.type == TransactionType.EXPENSE and t.id not in payment_transaction_ids
        ) or 0)

        expense_variation = None
        if prev_expense > 0:
            expense_variation = ((total_expense - prev_expense) / prev_expense) * 100

        # Calcular faturas pendentes (não pagas) do mês
        try:
            pending_invoices = await self._get_pending_invoices_total(user, year, month)
        except Exception:
            pending_invoices = 0

        # Total pendente = faturas não pagas
        pending_total = pending_invoices

        # Saldo disponível = Receitas - Despesas pagas - Pendentes
        available_balance = total_income - total_expense - pending_total

        return AnalyticsSummary(
            period_start=period_start,
            period_end=period_end,
            total_income=total_income,
            total_expense=total_expense,
            balance=total_income - total_expense,
            margin=total_income - total_expense,
            fixed_expenses=fixed_expenses,
            variable_expenses=variable_expenses,
            pending_invoices=pending_invoices,
            pending_total=pending_total,
            available_balance=available_balance,
            categories=categories,
            top_merchants=top_merchants[:10],
            previous_period_expense=prev_expense if prev_expense > 0 else None,
            expense_variation=expense_variation,
        )

    async def get_insights(
        self, user: User, start_date: date, end_date: date
    ) -> list[InsightResponse]:
        """Gera insights explicáveis sobre os gastos do usuário"""
        insights = []

        transactions = await self._get_transactions(user, start_date, end_date)
        expense_transactions = [
            t for t in transactions if t.type == TransactionType.EXPENSE
        ]

        if not expense_transactions:
            return insights

        total_expense = sum(t.amount for t in expense_transactions)

        # 1. Detectar vazamentos (gastos pequenos e frequentes que somam alto)
        leak_insights = await self._detect_leaks(expense_transactions, total_expense)
        insights.extend(leak_insights)

        # 2. Identificar principais drivers de gasto
        driver_insights = await self._identify_drivers(expense_transactions, total_expense)
        insights.extend(driver_insights)

        # 3. Oportunidades de redução
        opportunity_insights = await self._find_opportunities(expense_transactions)
        insights.extend(opportunity_insights)

        return insights[:5]  # Top 5 insights

    async def _get_transactions(
        self, user: User, start_date: date, end_date: date
    ) -> list[Transaction]:
        # Get household member IDs if user is part of a household
        household_user_ids = await self._get_household_user_ids(user)

        if household_user_ids:
            # User is in a household - get personal + household transactions
            result = await self.db.execute(
                select(Transaction).where(
                    Transaction.date >= start_date,
                    Transaction.date <= end_date,
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
            )
        else:
            # User is not in a household - get only their transactions
            result = await self.db.execute(
                select(Transaction).where(
                    Transaction.user_id == user.id,
                    Transaction.date >= start_date,
                    Transaction.date <= end_date,
                )
            )
        return list(result.scalars().all())

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

    async def _get_invoice_payment_transaction_ids(self, user: User) -> set[int]:
        """
        Retorna IDs de transações que são pagamentos de fatura.
        Essas transações devem ser excluídas do cálculo de despesas
        para evitar contagem dupla (contamos as compras, não o pagamento).
        """
        try:
            household_user_ids = await self._get_household_user_ids(user)
            user_ids = [user.id] + household_user_ids if household_user_ids else [user.id]

            result = await self.db.execute(
                select(CreditCardInvoice.payment_transaction_id).where(
                    CreditCardInvoice.user_id.in_(user_ids),
                    CreditCardInvoice.payment_transaction_id.isnot(None)
                )
            )
            return set(result.scalars().all())
        except Exception:
            return set()

    async def _get_pending_invoices_total(self, user: User, year: int, month: int) -> float:
        """
        Retorna o total de faturas não pagas para o mês.
        Considera faturas com status OPEN, CLOSED ou OVERDUE.
        """
        try:
            household_user_ids = await self._get_household_user_ids(user)
            user_ids = [user.id] + household_user_ids if household_user_ids else [user.id]

            # Buscar faturas não pagas do mês
            result = await self.db.execute(
                select(CreditCardInvoice).where(
                    CreditCardInvoice.user_id.in_(user_ids),
                    CreditCardInvoice.reference_year == year,
                    CreditCardInvoice.reference_month == month,
                    CreditCardInvoice.status.in_([
                        InvoiceStatus.OPEN.value,
                        InvoiceStatus.CLOSED.value,
                        InvoiceStatus.OVERDUE.value,
                    ])
                )
            )
            invoices = result.scalars().all()

            # Somar total das faturas menos o que já foi pago parcialmente
            total = sum(
                float(inv.total_amount or 0) - float(inv.paid_amount or 0)
                for inv in invoices
            )
            return total
        except Exception:
            return 0.0

    async def _group_by_category(
        self, transactions: list[Transaction], exclude_ids: set[int] | None = None
    ) -> list[CategorySummary]:
        from collections import defaultdict

        exclude_ids = exclude_ids or set()

        by_category: dict[int, list[Transaction]] = defaultdict(list)
        for t in transactions:
            if t.type == TransactionType.EXPENSE and t.category_id and t.id not in exclude_ids:
                by_category[t.category_id].append(t)

        total = sum(t.amount for t in transactions if t.type == TransactionType.EXPENSE and t.id not in exclude_ids)
        summaries = []

        for category_id, txs in by_category.items():
            cat_total = sum(t.amount for t in txs)
            # Buscar nome da categoria
            result = await self.db.execute(
                select(Category).where(Category.id == category_id)
            )
            category = result.scalar_one_or_none()
            name = category.name if category else "Sem categoria"

            summaries.append(
                CategorySummary(
                    category_id=category_id,
                    category_name=name,
                    total=cat_total,
                    count=len(txs),
                    percentage=(cat_total / total * 100) if total > 0 else 0,
                    average=cat_total / len(txs) if txs else 0,
                )
            )

        return sorted(summaries, key=lambda x: x.total, reverse=True)

    async def _group_by_merchant(
        self, transactions: list[Transaction], exclude_ids: set[int] | None = None
    ) -> list[MerchantSummary]:
        from collections import defaultdict

        exclude_ids = exclude_ids or set()

        by_merchant: dict[int | None, list[Transaction]] = defaultdict(list)
        for t in transactions:
            if t.type == TransactionType.EXPENSE and t.id not in exclude_ids:
                by_merchant[t.merchant_id].append(t)

        summaries = []
        for merchant_id, txs in by_merchant.items():
            name = "Outros"
            if merchant_id:
                result = await self.db.execute(
                    select(Merchant).where(Merchant.id == merchant_id)
                )
                merchant = result.scalar_one_or_none()
                name = merchant.name if merchant else "Desconhecido"

            summaries.append(
                MerchantSummary(
                    merchant_id=merchant_id,
                    merchant_name=name,
                    total=sum(t.amount for t in txs),
                    count=len(txs),
                )
            )

        return sorted(summaries, key=lambda x: x.total, reverse=True)

    async def _detect_leaks(
        self, transactions: list[Transaction], total: float
    ) -> list[InsightResponse]:
        """Detecta gastos pequenos frequentes que somam valores altos"""
        from collections import defaultdict

        insights = []

        # Agrupar por merchant
        by_merchant: dict[int, list[Transaction]] = defaultdict(list)
        for t in transactions:
            if t.merchant_id and t.amount < 50:  # Gastos pequenos
                by_merchant[t.merchant_id].append(t)

        for merchant_id, txs in by_merchant.items():
            if len(txs) >= 3:  # Pelo menos 3 ocorrências
                leak_total = sum(t.amount for t in txs)
                if leak_total >= total * 0.05:  # Representa pelo menos 5% do total
                    result = await self.db.execute(
                        select(Merchant).where(Merchant.id == merchant_id)
                    )
                    merchant = result.scalar_one_or_none()
                    name = merchant.name if merchant else "Estabelecimento"

                    insights.append(
                        InsightResponse(
                            type="leak",
                            title=f"Vazamento: {name}",
                            description=f"{len(txs)} gastos pequenos em {name} somaram R$ {leak_total:.2f}",
                            impact_value=leak_total,
                            calculation=f"{len(txs)} transações x média de R$ {leak_total/len(txs):.2f}",
                            action=f"Reduza visitas a {name} pela metade para economizar R$ {leak_total/2:.2f}/mês",
                            merchant_id=merchant_id,
                        )
                    )

        return insights

    async def _identify_drivers(
        self, transactions: list[Transaction], total: float
    ) -> list[InsightResponse]:
        """Identifica principais categorias de gasto"""
        insights = []
        categories = await self._group_by_category(transactions)

        for cat in categories[:2]:  # Top 2 categorias
            if cat.percentage >= 20:
                insights.append(
                    InsightResponse(
                        type="driver",
                        title=f"Principal gasto: {cat.category_name}",
                        description=f"{cat.category_name} representa {cat.percentage:.1f}% dos seus gastos",
                        impact_value=cat.total,
                        calculation=f"R$ {cat.total:.2f} de R$ {total:.2f} total",
                        action=f"Defina um teto de R$ {cat.total * 0.8:.2f} para {cat.category_name}",
                        category_id=cat.category_id,
                    )
                )

        return insights

    async def _find_opportunities(
        self, transactions: list[Transaction]
    ) -> list[InsightResponse]:
        """Encontra oportunidades de economia"""
        insights = []

        # Verificar assinaturas/recorrências
        recurring = [t for t in transactions if t.is_recurring or t.is_fixed]
        recurring_total = sum(t.amount for t in recurring)

        if recurring_total > 0:
            insights.append(
                InsightResponse(
                    type="opportunity",
                    title="Revise gastos fixos",
                    description=f"Você tem R$ {recurring_total:.2f} em gastos fixos/recorrentes",
                    impact_value=recurring_total * 0.1,
                    calculation=f"Redução de 10% em R$ {recurring_total:.2f}",
                    action="Revise assinaturas e contratos para possível renegociação",
                )
            )

        return insights
