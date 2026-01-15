from __future__ import annotations
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from calendar import monthrange

from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.models.merchant import Merchant
from app.models.user import User
from app.models.household import HouseholdMember
from app.models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from app.modules.analytics.schemas.analytics import (
    AnalyticsSummary,
    CategorySummary,
    MerchantSummary,
    InsightResponse,
    PaymentMethodSummary,
    PaymentMethodReport,
)
from app.models.transaction import PaymentMethod


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._household_user_ids_cache: dict[int, list[int]] = {}

    async def _get_household_user_ids_cached(self, user: User) -> list[int]:
        """Cached version of _get_household_user_ids"""
        if user.id not in self._household_user_ids_cache:
            self._household_user_ids_cache[user.id] = await self._get_household_user_ids(user)
        return self._household_user_ids_cache[user.id]

    async def get_monthly_summary(
        self, user: User, year: int, month: int
    ) -> AnalyticsSummary:
        # Calcular periodo
        _, last_day = monthrange(year, month)
        period_start = date(year, month, 1)
        period_end = date(year, month, last_day)

        # Periodo anterior para comparacao
        prev_start = period_start - timedelta(days=period_start.day)
        prev_end = period_start - timedelta(days=1)

        # Pre-cache household_user_ids (uma unica query)
        household_user_ids = await self._get_household_user_ids_cached(user)
        user_ids = [user.id] + household_user_ids if household_user_ids else [user.id]

        # Executar queries sequencialmente (SQLAlchemy async nao suporta paralelo na mesma sessao)
        transactions = await self._get_transactions_fast(user_ids, household_user_ids, period_start, period_end)
        payment_transaction_ids = await self._get_invoice_payment_ids_fast(user_ids)
        credit_card_expenses = await self._get_invoices_total_fast(user_ids, year, month)
        pending_invoices = await self._get_pending_invoices_fast(user_ids, year, month)

        # Calcular totais (converter para float para evitar problemas com Decimal)
        total_income = float(sum(
            t.amount for t in transactions if t.type == TransactionType.INCOME
        ) or 0)

        # Debito/Dinheiro = despesas SEM invoice_id (nao sao de cartao) no periodo
        debit_cash_expenses = float(sum(
            t.amount for t in transactions
            if t.type == TransactionType.EXPENSE
            and t.id not in payment_transaction_ids
            and getattr(t, 'invoice_id', None) is None
        ) or 0)

        # Total de despesas = faturas do mes + gastos no debito/dinheiro
        total_expense = credit_card_expenses + debit_cash_expenses

        # Fixos = despesas fixas no debito (nao conta cartao pois ja esta na fatura)
        fixed_expenses = float(sum(
            t.amount
            for t in transactions
            if t.type == TransactionType.EXPENSE
            and t.is_fixed
            and t.id not in payment_transaction_ids
            and getattr(t, 'invoice_id', None) is None
        ) or 0)
        variable_expenses = debit_cash_expenses - fixed_expenses

        # Agrupar por categoria e merchant (sem queries adicionais - usa dados em memoria)
        categories = self._group_by_category_sync(transactions, payment_transaction_ids)
        top_merchants = self._group_by_merchant_sync(transactions, payment_transaction_ids)

        # Buscar nomes de categorias e merchants em batch
        category_ids = [c["category_id"] for c in categories if c["category_id"]]
        merchant_ids = [m["merchant_id"] for m in top_merchants if m["merchant_id"]]

        cat_names = await self._get_category_names(category_ids) if category_ids else {}
        merch_names = await self._get_merchant_names(merchant_ids) if merchant_ids else {}

        # Aplicar nomes
        for c in categories:
            c["category_name"] = cat_names.get(c["category_id"], "Sem categoria") if c["category_id"] else "Sem categoria"
        for m in top_merchants:
            m["merchant_name"] = merch_names.get(m["merchant_id"], "Outros") if m["merchant_id"] else "Outros"

        # Converter para schemas
        categories_response = [
            CategorySummary(**c) for c in categories
        ]
        merchants_response = [
            MerchantSummary(**m) for m in top_merchants[:10]
        ]

        # Buscar transacoes do periodo anterior para comparacao
        prev_transactions = await self._get_transactions_fast(user_ids, household_user_ids, prev_start, prev_end)
        prev_expense = float(sum(
            t.amount for t in prev_transactions
            if t.type == TransactionType.EXPENSE and t.id not in payment_transaction_ids
        ) or 0)

        expense_variation = None
        if prev_expense > 0:
            expense_variation = ((total_expense - prev_expense) / prev_expense) * 100

        # Total pendente = faturas nao pagas
        pending_total = pending_invoices

        # Saldo disponivel = Receitas - Despesas pagas - Pendentes
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
            credit_card_expenses=credit_card_expenses,
            debit_cash_expenses=debit_cash_expenses,
            pending_invoices=pending_invoices,
            pending_total=pending_total,
            available_balance=available_balance,
            categories=categories_response,
            top_merchants=merchants_response,
            previous_period_expense=prev_expense if prev_expense > 0 else None,
            expense_variation=expense_variation,
        )

    async def _get_transactions_fast(
        self, user_ids: list[int], household_user_ids: list[int], start_date: date, end_date: date
    ) -> list[Transaction]:
        """Versao otimizada sem lookup de household_user_ids"""
        if household_user_ids:
            result = await self.db.execute(
                select(Transaction).where(
                    Transaction.date >= start_date,
                    Transaction.date <= end_date,
                    or_(
                        and_(
                            Transaction.user_id.in_(user_ids),
                            Transaction.ownership_type == "personal"
                        ),
                        and_(
                            Transaction.user_id.in_(user_ids),
                            Transaction.ownership_type == "household"
                        )
                    )
                )
            )
        else:
            result = await self.db.execute(
                select(Transaction).where(
                    Transaction.user_id.in_(user_ids),
                    Transaction.date >= start_date,
                    Transaction.date <= end_date,
                )
            )
        return list(result.scalars().all())

    async def _get_invoice_payment_ids_fast(self, user_ids: list[int]) -> set[int]:
        """Versao otimizada sem lookup de household_user_ids"""
        try:
            result = await self.db.execute(
                select(CreditCardInvoice.payment_transaction_id).where(
                    CreditCardInvoice.user_id.in_(user_ids),
                    CreditCardInvoice.payment_transaction_id.isnot(None)
                )
            )
            return set(result.scalars().all())
        except Exception:
            return set()

    async def _get_invoices_total_fast(self, user_ids: list[int], year: int, month: int) -> float:
        """Versao otimizada com SUM no banco"""
        try:
            result = await self.db.execute(
                select(func.coalesce(func.sum(CreditCardInvoice.total_amount), 0)).where(
                    CreditCardInvoice.user_id.in_(user_ids),
                    CreditCardInvoice.reference_year == year,
                    CreditCardInvoice.reference_month == month,
                )
            )
            return float(result.scalar() or 0)
        except Exception:
            return 0.0

    async def _get_pending_invoices_fast(self, user_ids: list[int], year: int, month: int) -> float:
        """Versao otimizada com calculo no banco"""
        try:
            result = await self.db.execute(
                select(
                    func.coalesce(
                        func.sum(CreditCardInvoice.total_amount - func.coalesce(CreditCardInvoice.paid_amount, 0)),
                        0
                    )
                ).where(
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
            return float(result.scalar() or 0)
        except Exception:
            return 0.0

    def _group_by_category_sync(
        self, transactions: list[Transaction], exclude_ids: set[int]
    ) -> list[dict]:
        """Agrupa por categoria sem queries (sync)"""
        from collections import defaultdict

        by_category: dict[int | None, list[Transaction]] = defaultdict(list)
        for t in transactions:
            if t.type == TransactionType.EXPENSE and t.id not in exclude_ids:
                by_category[t.category_id].append(t)

        total = float(sum(t.amount for t in transactions if t.type == TransactionType.EXPENSE and t.id not in exclude_ids) or 0)

        summaries = []
        for category_id, txs in by_category.items():
            cat_total = float(sum(t.amount for t in txs) or 0)
            summaries.append({
                "category_id": category_id,
                "category_name": "",  # Sera preenchido depois
                "total": cat_total,
                "count": len(txs),
                "percentage": (cat_total / total * 100) if total > 0 else 0,
                "average": cat_total / len(txs) if txs else 0,
            })

        return sorted(summaries, key=lambda x: x["total"], reverse=True)

    def _group_by_merchant_sync(
        self, transactions: list[Transaction], exclude_ids: set[int]
    ) -> list[dict]:
        """Agrupa por merchant sem queries (sync)"""
        from collections import defaultdict

        by_merchant: dict[int | None, list[Transaction]] = defaultdict(list)
        for t in transactions:
            if t.type == TransactionType.EXPENSE and t.id not in exclude_ids:
                by_merchant[t.merchant_id].append(t)

        summaries = []
        for merchant_id, txs in by_merchant.items():
            summaries.append({
                "merchant_id": merchant_id,
                "merchant_name": "",  # Sera preenchido depois
                "total": float(sum(t.amount for t in txs) or 0),
                "count": len(txs),
            })

        return sorted(summaries, key=lambda x: x["total"], reverse=True)

    async def _get_category_names(self, category_ids: list[int]) -> dict[int, str]:
        """Busca nomes de categorias em batch"""
        if not category_ids:
            return {}
        result = await self.db.execute(
            select(Category.id, Category.name).where(Category.id.in_(category_ids))
        )
        return {row[0]: row[1] for row in result.all()}

    async def _get_merchant_names(self, merchant_ids: list[int]) -> dict[int, str]:
        """Busca nomes de merchants em batch"""
        if not merchant_ids:
            return {}
        result = await self.db.execute(
            select(Merchant.id, Merchant.name).where(Merchant.id.in_(merchant_ids))
        )
        return {row[0]: row[1] for row in result.all()}

    async def get_insights(
        self, user: User, start_date: date, end_date: date
    ) -> list[InsightResponse]:
        """Gera insights explicaveis sobre os gastos do usuario"""
        try:
            insights = []

            transactions = await self._get_transactions(user, start_date, end_date)
            expense_transactions = [
                t for t in transactions if t.type == TransactionType.EXPENSE
            ]

            if not expense_transactions:
                return insights

            # Converter Decimal para float para evitar erros
            total_expense = float(sum(t.amount for t in expense_transactions) or 0)

            # 1. Detectar vazamentos (gastos pequenos e frequentes que somam alto)
            try:
                leak_insights = await self._detect_leaks(expense_transactions, total_expense)
                insights.extend(leak_insights)
            except Exception as e:
                print(f"Error detecting leaks: {e}")

            # 2. Identificar principais drivers de gasto
            try:
                driver_insights = await self._identify_drivers(expense_transactions, total_expense)
                insights.extend(driver_insights)
            except Exception as e:
                print(f"Error identifying drivers: {e}")

            # 3. Oportunidades de reducao
            try:
                opportunity_insights = await self._find_opportunities(expense_transactions)
                insights.extend(opportunity_insights)
            except Exception as e:
                print(f"Error finding opportunities: {e}")

            return insights[:5]  # Top 5 insights
        except Exception as e:
            print(f"Fatal error in get_insights: {e}")
            import traceback
            traceback.print_exc()
            raise

    async def get_spending_by_payment_method(
        self, user: User, start_date: date, end_date: date
    ) -> PaymentMethodReport:
        """Retorna relatorio de gastos agrupados por metodo de pagamento"""
        from collections import defaultdict

        transactions = await self._get_transactions(user, start_date, end_date)

        # Filtrar apenas despesas
        expense_transactions = [
            t for t in transactions if t.type == TransactionType.EXPENSE
        ]

        # Excluir pagamentos de fatura
        try:
            payment_transaction_ids = await self._get_invoice_payment_transaction_ids(user)
        except Exception:
            payment_transaction_ids = set()

        expense_transactions = [
            t for t in expense_transactions if t.id not in payment_transaction_ids
        ]

        total_expenses = float(sum(t.amount for t in expense_transactions) or 0)

        # Agrupar por payment_method
        by_payment_method: dict[str | None, list[Transaction]] = defaultdict(list)
        for t in expense_transactions:
            by_payment_method[t.payment_method].append(t)

        summaries = []
        for payment_method, txs in by_payment_method.items():
            method_total = float(sum(t.amount for t in txs))

            # Obter nome amigavel do metodo de pagamento
            display_name = self._get_payment_method_display(payment_method)

            summaries.append(
                PaymentMethodSummary(
                    payment_method=payment_method,
                    payment_method_display=display_name,
                    total=method_total,
                    count=len(txs),
                    percentage=(method_total / total_expenses * 100) if total_expenses > 0 else 0,
                    average=method_total / len(txs) if txs else 0,
                )
            )

        # Ordenar por total (maior primeiro)
        summaries.sort(key=lambda x: x.total, reverse=True)

        return PaymentMethodReport(
            period_start=start_date,
            period_end=end_date,
            total_expenses=total_expenses,
            by_payment_method=summaries,
        )

    def _get_payment_method_display(self, payment_method: str | None) -> str:
        """Retorna nome amigavel do metodo de pagamento"""
        if not payment_method:
            return "Nao especificado"

        display_names = {
            PaymentMethod.CREDIT_CARD.value: "Cartao de Credito",
            PaymentMethod.DEBIT_CARD.value: "Cartao de Debito",
            PaymentMethod.PIX.value: "PIX",
            PaymentMethod.BANK_TRANSFER.value: "Transferencia Bancaria",
            PaymentMethod.BOLETO.value: "Boleto",
            PaymentMethod.CASH.value: "Dinheiro",
            PaymentMethod.VOUCHER.value: "Vale Alimentacao/Refeicao",
        }
        return display_names.get(payment_method, payment_method)

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
        Retorna IDs de transacoes que sao pagamentos de fatura.
        Essas transacoes devem ser excluidas do calculo de despesas
        para evitar contagem dupla (contamos as compras, nao o pagamento).
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

    async def _get_invoices_total_for_month(self, user: User, year: int, month: int) -> float:
        """
        Retorna o total de TODAS as faturas do mes de referencia.
        Isso representa o valor total que sera/foi pago no mes, independente do status.
        """
        try:
            household_user_ids = await self._get_household_user_ids(user)
            user_ids = [user.id] + household_user_ids if household_user_ids else [user.id]

            result = await self.db.execute(
                select(CreditCardInvoice).where(
                    CreditCardInvoice.user_id.in_(user_ids),
                    CreditCardInvoice.reference_year == year,
                    CreditCardInvoice.reference_month == month,
                )
            )
            invoices = result.scalars().all()

            return float(sum(inv.total_amount or 0 for inv in invoices))
        except Exception:
            return 0.0

    async def _get_pending_invoices_total(self, user: User, year: int, month: int) -> float:
        """
        Retorna o total de faturas nao pagas para o mes.
        Considera faturas com status OPEN, CLOSED ou OVERDUE.
        """
        try:
            household_user_ids = await self._get_household_user_ids(user)
            user_ids = [user.id] + household_user_ids if household_user_ids else [user.id]

            # Buscar faturas nao pagas do mes
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

            # Somar total das faturas menos o que ja foi pago parcialmente
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

        # Buscar nomes de todas as categorias de uma vez
        category_ids = list(by_category.keys())
        category_names = {}
        if category_ids:
            result = await self.db.execute(
                select(Category.id, Category.name).where(Category.id.in_(category_ids))
            )
            category_names = {row[0]: row[1] for row in result.all()}

        summaries = []
        for category_id, txs in by_category.items():
            cat_total = sum(t.amount for t in txs)
            name = category_names.get(category_id, "Sem categoria")

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

        # Buscar nomes de todos os merchants de uma vez
        merchant_ids = [mid for mid in by_merchant.keys() if mid is not None]
        merchant_names = {}
        if merchant_ids:
            result = await self.db.execute(
                select(Merchant.id, Merchant.name).where(Merchant.id.in_(merchant_ids))
            )
            merchant_names = {row[0]: row[1] for row in result.all()}

        summaries = []
        for merchant_id, txs in by_merchant.items():
            if merchant_id:
                name = merchant_names.get(merchant_id, "Desconhecido")
            else:
                name = "Outros"

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
            if t.merchant_id and float(t.amount) < 50:  # Gastos pequenos
                by_merchant[t.merchant_id].append(t)

        # Filtrar merchants que atendem os criterios
        leak_candidates = {}
        for merchant_id, txs in by_merchant.items():
            if len(txs) >= 3:  # Pelo menos 3 ocorrencias
                leak_total = float(sum(t.amount for t in txs) or 0)
                if leak_total >= total * 0.05:  # Representa pelo menos 5% do total
                    leak_candidates[merchant_id] = (txs, leak_total)

        if not leak_candidates:
            return insights

        # Buscar nomes de todos os merchants de uma vez
        merchant_ids = list(leak_candidates.keys())
        merchant_names = {}
        if merchant_ids:  # Proteger contra lista vazia
            result = await self.db.execute(
                select(Merchant.id, Merchant.name).where(Merchant.id.in_(merchant_ids))
            )
            merchant_names = {row[0]: row[1] for row in result.all()}

        for merchant_id, (txs, leak_total) in leak_candidates.items():
            name = merchant_names.get(merchant_id, "Estabelecimento")
            avg_value = leak_total / len(txs) if len(txs) > 0 else 0
            insights.append(
                InsightResponse(
                    type="leak",
                    title=f"Vazamento: {name}",
                    description=f"{len(txs)} gastos pequenos em {name} somaram R$ {leak_total:.2f}",
                    impact_value=float(leak_total),
                    calculation=f"{len(txs)} transacoes x media de R$ {avg_value:.2f}",
                    action=f"Reduza visitas a {name} pela metade para economizar R$ {leak_total/2:.2f}/mes",
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
                        impact_value=float(cat.total),
                        calculation=f"R$ {float(cat.total):.2f} de R$ {total:.2f} total",
                        action=f"Defina um teto de R$ {float(cat.total) * 0.8:.2f} para {cat.category_name}",
                        category_id=cat.category_id,
                    )
                )

        return insights

    async def _find_opportunities(
        self, transactions: list[Transaction]
    ) -> list[InsightResponse]:
        """Encontra oportunidades de economia"""
        insights = []

        # Verificar assinaturas/recorrencias
        recurring = [t for t in transactions if t.is_recurring or t.is_fixed]
        recurring_total = float(sum(t.amount for t in recurring) or 0)

        if recurring_total > 0:
            insights.append(
                InsightResponse(
                    type="opportunity",
                    title="Revise gastos fixos",
                    description=f"Voce tem R$ {recurring_total:.2f} em gastos fixos/recorrentes",
                    impact_value=float(recurring_total * 0.1),
                    calculation=f"Reducao de 10% em R$ {recurring_total:.2f}",
                    action="Revise assinaturas e contratos para possivel renegociacao",
                )
            )

        return insights
