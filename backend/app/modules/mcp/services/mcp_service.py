from datetime import date, datetime
from decimal import Decimal
from typing import Any
from sqlalchemy import select, func, text, inspect, String
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from ....models import (
    User, Account, Transaction, Category, CreditCard,
    CreditCardInvoice, InstallmentSeries, Budget, BudgetItem,
    Goal, GoalContribution, Debt, DebtPayment, RecurringTransaction,
    IncomeSource, Document, Merchant,
)
from ..schemas import TableInfo, ColumnInfo, QueryRequest


# Mapeamento de tabelas permitidas e suas descrições
ALLOWED_TABLES = {
    "accounts": {
        "model": Account,
        "description": "Contas financeiras (carteira, banco, cartão, investimento)",
        "columns": {
            "id": "ID único da conta",
            "name": "Nome da conta",
            "type": "Tipo: wallet, bank, credit_card, investment",
            "bank_id": "Identificador do banco",
            "balance": "Saldo atual",
            "currency": "Moeda (BRL)",
            "color": "Cor hexadecimal",
            "icon": "Ícone",
            "is_active": "Se está ativa",
            "ownership_type": "personal ou household",
            "created_at": "Data de criação",
            "updated_at": "Data de atualização",
        }
    },
    "transactions": {
        "model": Transaction,
        "description": "Transações financeiras (despesas, receitas, transferências)",
        "columns": {
            "id": "ID único",
            "account_id": "ID da conta",
            "category_id": "ID da categoria",
            "credit_card_id": "ID do cartão (se crédito)",
            "invoice_id": "ID da fatura",
            "income_source_id": "ID da fonte de renda",
            "type": "expense, income ou transfer",
            "payment_method": "Método de pagamento",
            "amount": "Valor",
            "date": "Data da transação",
            "description": "Descrição",
            "notes": "Observações",
            "is_recurring": "Se é recorrente",
            "installment_number": "Parcela atual",
            "installment_total": "Total de parcelas",
            "is_paid": "Se foi paga",
            "tags": "Tags (JSON)",
            "is_fixed": "Se é despesa fixa",
            "ownership_type": "personal ou household",
            "created_at": "Data de criação",
        }
    },
    "categories": {
        "model": Category,
        "description": "Categorias para classificar transações",
        "columns": {
            "id": "ID único",
            "name": "Nome",
            "type": "expense ou income",
            "icon": "Ícone",
            "color": "Cor",
            "parent_id": "ID da categoria pai",
            "is_system": "Se é do sistema",
            "created_at": "Data de criação",
        }
    },
    "credit_cards": {
        "model": CreditCard,
        "description": "Cartões de crédito",
        "columns": {
            "id": "ID único",
            "account_id": "ID da conta vinculada",
            "credit_limit": "Limite de crédito",
            "closing_day": "Dia de fechamento",
            "due_day": "Dia de vencimento",
            "has_points": "Se acumula pontos",
            "points_program": "Programa de pontos",
            "nickname": "Apelido do cartão",
            "card_brand": "Bandeira",
            "card_variant": "Variante (Platinum, Black)",
            "annual_fee": "Anuidade",
            "is_active": "Se está ativo",
            "created_at": "Data de criação",
        }
    },
    "credit_card_invoices": {
        "model": CreditCardInvoice,
        "description": "Faturas de cartão de crédito",
        "columns": {
            "id": "ID único",
            "credit_card_id": "ID do cartão",
            "reference_month": "Mês de referência",
            "reference_year": "Ano de referência",
            "closing_date": "Data de fechamento",
            "due_date": "Data de vencimento",
            "total_amount": "Valor total",
            "minimum_payment": "Pagamento mínimo",
            "status": "open, closed, paid, partial, overdue",
            "paid_amount": "Valor pago",
            "paid_at": "Data de pagamento",
            "created_at": "Data de criação",
        }
    },
    "installment_series": {
        "model": InstallmentSeries,
        "description": "Séries de compras parceladas",
        "columns": {
            "id": "ID único",
            "description": "Descrição da compra",
            "merchant_name": "Nome do comerciante",
            "total_amount": "Valor total",
            "installment_amount": "Valor da parcela",
            "installment_count": "Total de parcelas",
            "purchase_date": "Data da compra",
            "first_installment_date": "Data da primeira parcela",
            "credit_card_id": "ID do cartão",
            "status": "active, completed, cancelled",
            "paid_count": "Parcelas pagas",
            "created_at": "Data de criação",
        }
    },
    "budgets": {
        "model": Budget,
        "description": "Orçamentos mensais",
        "columns": {
            "id": "ID único",
            "year": "Ano",
            "month": "Mês",
            "total_income_planned": "Receita planejada",
            "total_expense_planned": "Despesa planejada",
            "allow_rollover": "Permite acumular",
            "ownership_type": "personal ou household",
            "created_at": "Data de criação",
        }
    },
    "budget_items": {
        "model": BudgetItem,
        "description": "Itens do orçamento por categoria",
        "columns": {
            "id": "ID único",
            "budget_id": "ID do orçamento",
            "category_id": "ID da categoria",
            "planned_amount": "Valor planejado",
            "rollover_amount": "Valor acumulado",
            "is_fixed": "Se é despesa fixa",
            "priority": "Prioridade",
            "created_at": "Data de criação",
        }
    },
    "goals": {
        "model": Goal,
        "description": "Metas financeiras",
        "columns": {
            "id": "ID único",
            "name": "Nome",
            "description": "Descrição",
            "type": "savings, emergency, debt_free, investment, etc",
            "target_amount": "Valor alvo",
            "current_amount": "Valor atual",
            "start_date": "Data de início",
            "target_date": "Data alvo",
            "status": "active, paused, completed, cancelled",
            "ownership_type": "personal ou household",
            "created_at": "Data de criação",
        }
    },
    "goal_contributions": {
        "model": GoalContribution,
        "description": "Contribuições para metas",
        "columns": {
            "id": "ID único",
            "goal_id": "ID da meta",
            "amount": "Valor",
            "contribution_date": "Data",
            "notes": "Observações",
            "created_at": "Data de criação",
        }
    },
    "debts": {
        "model": Debt,
        "description": "Dívidas",
        "columns": {
            "id": "ID único",
            "name": "Nome",
            "type": "Tipo da dívida",
            "creditor": "Credor",
            "original_amount": "Valor original",
            "current_balance": "Saldo atual",
            "minimum_payment": "Pagamento mínimo",
            "interest_rate": "Taxa de juros",
            "status": "active, paid_off, negotiating, defaulted",
            "ownership_type": "personal ou household",
            "created_at": "Data de criação",
        }
    },
    "debt_payments": {
        "model": DebtPayment,
        "description": "Pagamentos de dívidas",
        "columns": {
            "id": "ID único",
            "debt_id": "ID da dívida",
            "amount": "Valor total",
            "principal_amount": "Valor amortizado",
            "interest_amount": "Valor de juros",
            "payment_date": "Data",
            "created_at": "Data de criação",
        }
    },
    "recurring_transactions": {
        "model": RecurringTransaction,
        "description": "Transações recorrentes programadas",
        "columns": {
            "id": "ID único",
            "account_id": "ID da conta",
            "category_id": "ID da categoria",
            "name": "Nome",
            "amount": "Valor",
            "type": "expense ou income",
            "frequency": "daily, weekly, monthly, yearly",
            "day_of_month": "Dia do mês",
            "start_date": "Data de início",
            "end_date": "Data de término",
            "status": "active, paused, cancelled",
            "next_due_date": "Próxima data",
            "ownership_type": "personal ou household",
            "created_at": "Data de criação",
        }
    },
    "income_sources": {
        "model": IncomeSource,
        "description": "Fontes de renda",
        "columns": {
            "id": "ID único",
            "name": "Nome",
            "type": "salary, freelance, business, rental, etc",
            "source_name": "Nome da empresa/fonte",
            "expected_amount": "Valor esperado",
            "is_variable": "Se é variável",
            "frequency": "Frequência",
            "payment_day": "Dia de pagamento",
            "is_active": "Se está ativa",
            "ownership_type": "personal ou household",
            "created_at": "Data de criação",
        }
    },
    "documents": {
        "model": Document,
        "description": "Documentos/comprovantes",
        "columns": {
            "id": "ID único",
            "original_filename": "Nome original",
            "mime_type": "Tipo MIME",
            "status": "pending, processing, completed, failed",
            "document_type": "Tipo do documento",
            "created_at": "Data de criação",
            "processed_at": "Data de processamento",
        }
    },
    "merchants": {
        "model": Merchant,
        "description": "Comerciantes identificados",
        "columns": {
            "id": "ID único",
            "name": "Nome",
            "normalized_name": "Nome normalizado",
            "cnpj": "CNPJ",
            "category_id": "Categoria sugerida",
            "created_at": "Data de criação",
        }
    },
}


def serialize_value(value: Any) -> Any:
    """Serializa valores para JSON"""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


class MCPService:
    """Service para consultas MCP"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def get_table_list(self) -> list[TableInfo]:
        """Lista todas as tabelas disponíveis com suas descrições"""
        tables = []
        for name, info in ALLOWED_TABLES.items():
            columns = [
                ColumnInfo(name=col, description=desc)
                for col, desc in info["columns"].items()
            ]
            tables.append(TableInfo(
                name=name,
                description=info["description"],
                columns=columns,
            ))
        return tables

    async def query_table(
        self,
        user: User,
        request: QueryRequest,
    ) -> tuple[list[dict], int]:
        """
        Consulta uma tabela filtrando pelo user_id.
        Retorna (dados, total).
        """
        if request.table not in ALLOWED_TABLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tabela '{request.table}' não permitida. Use /mcp/tables para ver tabelas disponíveis."
            )

        table_info = ALLOWED_TABLES[request.table]
        model = table_info["model"]

        # Verifica se a tabela tem user_id (para filtrar)
        has_user_id = hasattr(model, "user_id")

        # Query base
        query = select(model)

        # Filtro por user_id (segurança)
        if has_user_id:
            query = query.where(model.user_id == user.id)

        # Filtro de busca por texto (search)
        if request.search:
            search_term = f"%{request.search}%"
            if hasattr(model, "description"):
                query = query.where(model.description.ilike(search_term))
            elif hasattr(model, "name"):
                query = query.where(model.name.ilike(search_term))

        # Filtro de data (date_from, date_to)
        if hasattr(model, "date"):
            if request.date_from:
                query = query.where(model.date >= request.date_from)
            if request.date_to:
                query = query.where(model.date <= request.date_to)

        # Filtro de valor (amount_min, amount_max)
        if hasattr(model, "amount"):
            if request.amount_min is not None:
                query = query.where(model.amount >= request.amount_min)
            if request.amount_max is not None:
                query = query.where(model.amount <= request.amount_max)

        # Filtros exatos adicionais
        if request.filters:
            for col, val in request.filters.items():
                if hasattr(model, col):
                    column = getattr(model, col)
                    if val is None:
                        query = query.where(column.is_(None))
                    elif isinstance(val, list):
                        query = query.where(column.in_(val))
                    else:
                        query = query.where(column == val)

        # Conta total antes de limit/offset
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Ordenação
        if request.order_by and hasattr(model, request.order_by):
            order_col = getattr(model, request.order_by)
            query = query.order_by(order_col.desc() if request.order_desc else order_col)
        elif hasattr(model, "created_at"):
            query = query.order_by(model.created_at.desc())

        # Paginação
        query = query.limit(request.limit).offset(request.offset)

        # Executa
        result = await self.db.execute(query)
        rows = result.scalars().all()

        # Converte para dicts
        data = []
        for row in rows:
            row_dict = {}
            mapper = inspect(row.__class__)
            for column in mapper.columns:
                value = getattr(row, column.key)
                row_dict[column.key] = serialize_value(value)
            data.append(row_dict)

        return data, total

    async def get_table_stats(self, user: User, table_name: str) -> dict:
        """Retorna estatísticas de uma tabela"""
        if table_name not in ALLOWED_TABLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tabela '{table_name}' não permitida."
            )

        table_info = ALLOWED_TABLES[table_name]
        model = table_info["model"]
        has_user_id = hasattr(model, "user_id")

        # Query base
        query = select(model)
        if has_user_id:
            query = query.where(model.user_id == user.id)

        # Conta total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        return {
            "table": table_name,
            "total_records": total,
            "columns": table_info["columns"],
        }

    async def get_summary(self, user: User) -> dict:
        """Retorna um resumo geral dos dados do usuário"""
        summary = {}

        # Contas
        accounts_result = await self.db.execute(
            select(func.count(), func.sum(Account.balance))
            .where(Account.user_id == user.id, Account.is_active == True)
        )
        accounts_row = accounts_result.fetchone()
        summary["accounts"] = {
            "count": accounts_row[0] or 0,
            "total_balance": float(accounts_row[1]) if accounts_row[1] else 0,
        }

        # Transações do mês atual
        today = date.today()
        first_of_month = date(today.year, today.month, 1)
        transactions_result = await self.db.execute(
            select(
                func.count(),
                func.sum(Transaction.amount).filter(Transaction.type == "expense"),
                func.sum(Transaction.amount).filter(Transaction.type == "income"),
            )
            .where(
                Transaction.user_id == user.id,
                Transaction.date >= first_of_month,
            )
        )
        trans_row = transactions_result.fetchone()
        summary["transactions_this_month"] = {
            "count": trans_row[0] or 0,
            "total_expenses": float(trans_row[1]) if trans_row[1] else 0,
            "total_income": float(trans_row[2]) if trans_row[2] else 0,
        }

        # Cartões de crédito
        cards_result = await self.db.execute(
            select(func.count())
            .where(CreditCard.user_id == user.id, CreditCard.is_active == True)
        )
        summary["credit_cards"] = {
            "count": cards_result.scalar() or 0,
        }

        # Faturas abertas
        invoices_result = await self.db.execute(
            select(func.count(), func.sum(CreditCardInvoice.total_amount))
            .where(
                CreditCardInvoice.user_id == user.id,
                CreditCardInvoice.status.in_(["open", "closed"]),
            )
        )
        inv_row = invoices_result.fetchone()
        summary["open_invoices"] = {
            "count": inv_row[0] or 0,
            "total_amount": float(inv_row[1]) if inv_row[1] else 0,
        }

        # Metas ativas
        goals_result = await self.db.execute(
            select(func.count(), func.sum(Goal.current_amount), func.sum(Goal.target_amount))
            .where(Goal.user_id == user.id, Goal.status == "active")
        )
        goals_row = goals_result.fetchone()
        summary["active_goals"] = {
            "count": goals_row[0] or 0,
            "current_total": float(goals_row[1]) if goals_row[1] else 0,
            "target_total": float(goals_row[2]) if goals_row[2] else 0,
        }

        # Dívidas ativas
        debts_result = await self.db.execute(
            select(func.count(), func.sum(Debt.current_balance))
            .where(Debt.user_id == user.id, Debt.status == "active")
        )
        debts_row = debts_result.fetchone()
        summary["active_debts"] = {
            "count": debts_row[0] or 0,
            "total_balance": float(debts_row[1]) if debts_row[1] else 0,
        }

        return summary
