"""
Agente IA Financeiro - Assistente Inteligente de Financas Pessoais
Suporta: Google Gemini (gratuito) e Mistral AI (melhor custo-beneficio)
Com analise detalhada de gastos por categoria, estabelecimento, periodo, cartoes e receitas.
"""
from __future__ import annotations
import json
import httpx
import uuid
import re
from datetime import date, datetime, timedelta
from typing import Any
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from collections import defaultdict

from app.core.config import settings
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.models.merchant import Merchant
from app.models.debt import Debt, DebtStatus
from app.models.goal import Goal
from app.models.budget import Budget, BudgetItem
from app.models.account import Account
from app.models.household import HouseholdMember
from app.models.credit_card import CreditCard
from app.models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from app.models.income_source import IncomeSource
from app.modules.chat.schemas.chat import ChatResponse


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)


class FinancialAgentService:
    """Agente IA para recomendacoes financeiras personalizadas"""

    # Mapeamento de meses em portugues
    MONTHS_PT = {
        "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4,
        "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
        "outubro": 10, "novembro": 11, "dezembro": 12,
        "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
        "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12
    }

    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = settings.vision_provider
        self.conversations: dict[str, list[dict]] = {}

    async def chat(self, user: User, message: str, conversation_id: str | None = None) -> ChatResponse:
        """Processa mensagem do usuario e retorna resposta do agente"""

        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            self.conversations[conversation_id] = []

        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []

        # Analisar a pergunta para extrair periodo e filtros
        query_context = self._parse_query(message)

        # Buscar contexto financeiro completo
        context = await self._get_comprehensive_context(user, query_context)
        data_used = list(context.keys())

        # Montar prompt do sistema
        system_prompt = self._build_enhanced_system_prompt(context, message)

        # Adicionar mensagem ao historico
        self.conversations[conversation_id].append({
            "role": "user",
            "content": message
        })

        # Chamar LLM
        response_text = await self._call_llm(system_prompt, self.conversations[conversation_id])

        # Adicionar resposta ao historico
        self.conversations[conversation_id].append({
            "role": "assistant",
            "content": response_text
        })

        # Gerar sugestoes de follow-up
        suggestions = self._generate_smart_suggestions(message, context)

        return ChatResponse(
            message=response_text,
            conversation_id=conversation_id,
            suggestions=suggestions,
            data_used=data_used
        )

    def _parse_query(self, message: str) -> dict[str, Any]:
        """Analisa a mensagem para extrair periodo, categorias e filtros"""
        message_lower = message.lower()
        query: dict[str, Any] = {
            "period": None,
            "category_keywords": [],
            "merchant_keywords": [],
            "comparison": False,
        }

        today = date.today()

        # Detectar mes especifico
        for month_name, month_num in self.MONTHS_PT.items():
            if month_name in message_lower:
                year = today.year
                if month_num > today.month:
                    year -= 1
                query["period"] = {
                    "start": date(year, month_num, 1),
                    "end": (date(year, month_num, 1) + relativedelta(months=1)) - timedelta(days=1),
                    "label": f"{month_name.capitalize()}/{year}"
                }
                break

        # Detectar periodos relativos
        if not query["period"]:
            if "esse mes" in message_lower or "este mes" in message_lower or "mes atual" in message_lower:
                query["period"] = {
                    "start": date(today.year, today.month, 1),
                    "end": today,
                    "label": "Mes atual"
                }
            elif "mes passado" in message_lower or "ultimo mes" in message_lower:
                last_month = today - relativedelta(months=1)
                query["period"] = {
                    "start": date(last_month.year, last_month.month, 1),
                    "end": (date(last_month.year, last_month.month, 1) + relativedelta(months=1)) - timedelta(days=1),
                    "label": "Mes passado"
                }
            elif "ultimos 3 meses" in message_lower:
                start = today - relativedelta(months=3)
                query["period"] = {
                    "start": date(start.year, start.month, 1),
                    "end": today,
                    "label": "Ultimos 3 meses"
                }
            elif "esse ano" in message_lower or "este ano" in message_lower or "ano atual" in message_lower:
                query["period"] = {
                    "start": date(today.year, 1, 1),
                    "end": today,
                    "label": f"Ano {today.year}"
                }

        # Se nao detectou periodo, usar mes atual como padrao
        if not query["period"]:
            query["period"] = {
                "start": date(today.year, today.month, 1),
                "end": today,
                "label": "Mes atual"
            }

        # Detectar categorias mencionadas
        category_keywords = [
            "alimentacao", "comida", "restaurante", "mercado", "supermercado",
            "transporte", "uber", "gasolina", "combustivel",
            "lazer", "entretenimento", "netflix", "streaming",
            "saude", "farmacia", "medico", "hospital",
            "educacao", "escola", "curso", "faculdade",
            "moradia", "aluguel", "condominio", "luz", "agua", "gas",
            "roupas", "vestuario", "shopping",
            "carne", "acougue", "proteina",
            "ifood", "delivery", "rappi",
            "assinatura", "spotify", "amazon"
        ]

        for keyword in category_keywords:
            if keyword in message_lower:
                query["category_keywords"].append(keyword)

        # Detectar comparacao
        if "comparar" in message_lower or "versus" in message_lower or "vs" in message_lower:
            query["comparison"] = True

        return query

    async def _get_comprehensive_context(self, user: User, query_context: dict[str, Any]) -> dict[str, Any]:
        """Busca contexto financeiro completo e detalhado"""
        context: dict[str, Any] = {}
        today = date.today()
        period = query_context.get("period") or {}
        period_start = period.get("start", date(today.year, today.month, 1))
        period_end = period.get("end", today)
        period_label = period.get("label", "Periodo selecionado")

        household_user_ids = await self._get_household_user_ids(user)

        # 1. Buscar categorias do usuario
        categories_result = await self.db.execute(
            select(Category).where(Category.user_id == user.id)
        )
        categories: dict[int | None, str] = {c.id: c.name for c in categories_result.scalars().all()}
        context["categorias_disponiveis"] = list(categories.values())

        # 2. Resumo de contas
        if household_user_ids:
            accounts_query = select(Account).where(
                or_(
                    and_(Account.user_id == user.id, Account.ownership_type == "personal"),
                    and_(Account.user_id.in_(household_user_ids), Account.ownership_type == "household")
                )
            )
        else:
            accounts_query = select(Account).where(Account.user_id == user.id)

        accounts = await self.db.execute(accounts_query)
        accounts_list = accounts.scalars().all()
        context["contas"] = [
            {"nome": a.name, "tipo": a.type, "saldo": float(a.balance)}
            for a in accounts_list
        ]
        context["saldo_total"] = sum(float(a.balance) for a in accounts_list)

        # 3. Transacoes do periodo selecionado com detalhes completos
        if household_user_ids:
            tx_query = select(Transaction).where(
                Transaction.date >= period_start,
                Transaction.date <= period_end,
                or_(
                    and_(Transaction.user_id == user.id, Transaction.ownership_type == "personal"),
                    and_(Transaction.user_id.in_(household_user_ids), Transaction.ownership_type == "household")
                )
            )
        else:
            tx_query = select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.date >= period_start,
                Transaction.date <= period_end
            )

        transactions = await self.db.execute(tx_query)
        txs = transactions.scalars().all()

        # Buscar merchants para mapear IDs para nomes
        merchant_ids = [t.merchant_id for t in txs if t.merchant_id]
        merchants: dict[int | None, str] = {}
        if merchant_ids:
            merchants_result = await self.db.execute(
                select(Merchant).where(Merchant.id.in_(merchant_ids))
            )
            merchants = {m.id: m.name for m in merchants_result.scalars().all()}

        # Calcular totais
        receitas = sum(float(t.amount) for t in txs if t.type == TransactionType.INCOME.value)
        despesas = sum(float(t.amount) for t in txs if t.type == TransactionType.EXPENSE.value)

        context["periodo_analise"] = {
            "label": period_label,
            "inicio": period_start.strftime("%d/%m/%Y"),
            "fim": period_end.strftime("%d/%m/%Y"),
        }

        context["resumo_periodo"] = {
            "receitas": receitas,
            "despesas": despesas,
            "saldo": receitas - despesas,
            "total_transacoes": len(txs),
            "media_diaria_gastos": round(despesas / max(1, (period_end - period_start).days + 1), 2)
        }

        # 4. Gastos por categoria (DETALHADO)
        gastos_por_categoria: dict[str, Any] = defaultdict(lambda: {"total": 0, "count": 0, "transacoes": []})
        for t in txs:
            if t.type == TransactionType.EXPENSE.value:
                cat_name = categories.get(t.category_id, "Sem categoria")
                merchant_name = merchants.get(t.merchant_id, t.description or "Nao identificado")
                gastos_por_categoria[cat_name]["total"] += float(t.amount)
                gastos_por_categoria[cat_name]["count"] += 1
                gastos_por_categoria[cat_name]["transacoes"].append({
                    "valor": float(t.amount),
                    "data": t.date.strftime("%d/%m"),
                    "estabelecimento": merchant_name,
                    "descricao": t.description
                })

        # Ordenar por valor
        context["gastos_por_categoria"] = dict(
            sorted(gastos_por_categoria.items(), key=lambda x: x[1]["total"], reverse=True)
        )

        # 5. Gastos por estabelecimento
        gastos_por_estabelecimento: dict[str, Any] = defaultdict(lambda: {"total": 0, "count": 0, "categoria": None})
        for t in txs:
            if t.type == TransactionType.EXPENSE.value:
                merchant_name = merchants.get(t.merchant_id, t.description or "Outros")
                cat_name = categories.get(t.category_id, "Sem categoria")
                gastos_por_estabelecimento[merchant_name]["total"] += float(t.amount)
                gastos_por_estabelecimento[merchant_name]["count"] += 1
                gastos_por_estabelecimento[merchant_name]["categoria"] = cat_name

        context["gastos_por_estabelecimento"] = dict(
            sorted(gastos_por_estabelecimento.items(), key=lambda x: x[1]["total"], reverse=True)[:15]
        )

        # 6. Receitas por categoria
        receitas_por_categoria: dict[str, Any] = defaultdict(lambda: {"total": 0, "count": 0})
        for t in txs:
            if t.type == TransactionType.INCOME.value:
                cat_name = categories.get(t.category_id, "Sem categoria")
                receitas_por_categoria[cat_name]["total"] += float(t.amount)
                receitas_por_categoria[cat_name]["count"] += 1

        context["receitas_por_categoria"] = dict(receitas_por_categoria)

        # 7. Top 10 maiores gastos do periodo
        despesas_list = [t for t in txs if t.type == TransactionType.EXPENSE.value]
        despesas_list.sort(key=lambda x: float(x.amount), reverse=True)
        context["maiores_gastos"] = [
            {
                "valor": float(t.amount),
                "data": t.date.strftime("%d/%m/%Y"),
                "estabelecimento": merchants.get(t.merchant_id, t.description or "Nao identificado"),
                "categoria": categories.get(t.category_id, "Sem categoria")
            }
            for t in despesas_list[:10]
        ]

        # 8. Dividas ativas
        debts = await self.db.execute(
            select(Debt).where(
                Debt.user_id == user.id,
                Debt.status == DebtStatus.ACTIVE.value
            )
        )
        debts_list = debts.scalars().all()
        context["dividas"] = [
            {
                "nome": d.name,
                "saldo": float(d.current_balance),
                "taxa_juros": float(d.interest_rate) * 100,
                "pagamento_minimo": float(d.minimum_payment),
                "tipo": d.type
            }
            for d in debts_list
        ]
        context["total_dividas"] = sum(float(d.current_balance) for d in debts_list)

        # 9. Metas financeiras
        goals = await self.db.execute(
            select(Goal).where(
                Goal.user_id == user.id,
                Goal.status == "active"
            )
        )
        goals_list = goals.scalars().all()
        context["metas"] = [
            {
                "nome": g.name,
                "valor_alvo": float(g.target_amount),
                "valor_atual": float(g.current_amount),
                "progresso": round(float(g.current_amount / g.target_amount * 100), 1) if g.target_amount > 0 else 0,
                "prazo": g.target_date.strftime("%d/%m/%Y") if g.target_date else None,
                "falta": float(g.target_amount - g.current_amount)
            }
            for g in goals_list
        ]

        # 10. Orcamento do mes
        budget_result = await self.db.execute(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.year == today.year,
                Budget.month == today.month
            )
        )
        budget = budget_result.scalar_one_or_none()

        if budget:
            items_result = await self.db.execute(
                select(BudgetItem).where(BudgetItem.budget_id == budget.id)
            )
            budget_items = items_result.scalars().all()

            orcamento_items = []
            for b in budget_items:
                cat_name = categories.get(b.category_id, "Categoria")
                gasto_atual = gastos_por_categoria.get(cat_name, {}).get("total", 0)
                orcamento_items.append({
                    "categoria": cat_name,
                    "planejado": float(b.planned_amount),
                    "gasto": gasto_atual,
                    "restante": float(b.planned_amount) - gasto_atual,
                    "percentual_usado": round(gasto_atual / float(b.planned_amount) * 100, 1) if b.planned_amount > 0 else 0
                })
            context["orcamento"] = orcamento_items
        else:
            context["orcamento"] = []

        # 11. Comparacao com mes anterior (se relevante)
        last_month = today - relativedelta(months=1)
        last_month_start = date(last_month.year, last_month.month, 1)
        last_month_end = (date(last_month.year, last_month.month, 1) + relativedelta(months=1)) - timedelta(days=1)

        if household_user_ids:
            last_month_query = select(Transaction).where(
                Transaction.date >= last_month_start,
                Transaction.date <= last_month_end,
                or_(
                    and_(Transaction.user_id == user.id, Transaction.ownership_type == "personal"),
                    and_(Transaction.user_id.in_(household_user_ids), Transaction.ownership_type == "household")
                )
            )
        else:
            last_month_query = select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.date >= last_month_start,
                Transaction.date <= last_month_end
            )

        last_txs = await self.db.execute(last_month_query)
        last_txs_list = last_txs.scalars().all()

        last_despesas = sum(float(t.amount) for t in last_txs_list if t.type == TransactionType.EXPENSE.value)
        last_receitas = sum(float(t.amount) for t in last_txs_list if t.type == TransactionType.INCOME.value)

        context["comparacao_mes_anterior"] = {
            "despesas_mes_anterior": last_despesas,
            "receitas_mes_anterior": last_receitas,
            "variacao_despesas": round(((despesas - last_despesas) / max(1, last_despesas)) * 100, 1) if last_despesas > 0 else 0,
            "variacao_receitas": round(((receitas - last_receitas) / max(1, last_receitas)) * 100, 1) if last_receitas > 0 else 0,
        }

        # 12. Cartoes de credito e faturas
        credit_cards_result = await self.db.execute(
            select(CreditCard).where(
                CreditCard.user_id == user.id,
                CreditCard.is_active == True
            )
        )
        credit_cards_list = credit_cards_result.scalars().all()

        cartoes_info = []
        for card in credit_cards_list:
            # Buscar faturas abertas (OPEN) e proximas a vencer (CLOSED)
            invoices_result = await self.db.execute(
                select(CreditCardInvoice).where(
                    CreditCardInvoice.credit_card_id == card.id,
                    or_(
                        CreditCardInvoice.status == InvoiceStatus.OPEN.value,
                        CreditCardInvoice.status == InvoiceStatus.CLOSED.value,
                        CreditCardInvoice.status == InvoiceStatus.PARTIAL.value,
                        CreditCardInvoice.status == InvoiceStatus.OVERDUE.value
                    )
                ).order_by(
                    CreditCardInvoice.reference_year.desc(),
                    CreditCardInvoice.reference_month.desc()
                )
            )
            invoices_list = invoices_result.scalars().all()

            # Calcular saldo em aberto (faturas nao pagas)
            saldo_em_aberto = sum(
                float(inv.remaining_amount)
                for inv in invoices_list
                if inv.status != InvoiceStatus.PAID.value
            )

            # Buscar conta vinculada para pegar o nome
            account_result = await self.db.execute(
                select(Account).where(Account.id == card.account_id)
            )
            account = account_result.scalar_one_or_none()

            faturas_info = []
            for inv in invoices_list[:3]:  # Mostrar até 3 faturas mais recentes
                faturas_info.append({
                    "periodo": inv.period_display,
                    "mes": inv.reference_month,
                    "ano": inv.reference_year,
                    "status": inv.status,
                    "valor_total": float(inv.total_amount),
                    "valor_pago": float(inv.paid_amount),
                    "valor_restante": float(inv.remaining_amount),
                    "vencimento": inv.due_date.strftime("%d/%m/%Y"),
                    "fechamento": inv.closing_date.strftime("%d/%m/%Y"),
                    "vencida": inv.is_overdue
                })

            cartoes_info.append({
                "nome": account.name if account else "Cartao",
                "bandeira": card.card_brand,
                "variante": card.card_variant,
                "ultimos_digitos": card.last_four_digits,
                "limite_total": float(card.credit_limit),
                "saldo_em_aberto": saldo_em_aberto,
                "limite_disponivel": float(card.credit_limit) - saldo_em_aberto,
                "dia_fechamento": card.closing_day,
                "dia_vencimento": card.due_day,
                "anuidade": float(card.annual_fee) if card.annual_fee else 0,
                "anuidade_isenta": card.annual_fee_waived,
                "faturas": faturas_info
            })

        context["cartoes_credito"] = cartoes_info

        # 13. Fontes de receita planejadas
        income_sources_result = await self.db.execute(
            select(IncomeSource).where(
                IncomeSource.user_id == user.id,
                IncomeSource.is_active == True
            )
        )
        income_sources_list = income_sources_result.scalars().all()

        fontes_receita = []
        for source in income_sources_list:
            # Buscar conta vinculada
            source_account = None
            if source.account_id:
                acc_result = await self.db.execute(
                    select(Account).where(Account.id == source.account_id)
                )
                source_account = acc_result.scalar_one_or_none()

            # Buscar categoria vinculada
            source_category = None
            if source.category_id:
                cat_result = await self.db.execute(
                    select(Category).where(Category.id == source.category_id)
                )
                source_category = cat_result.scalar_one_or_none()

            receita_info = {
                "nome": source.name,
                "tipo": source.type,
                "empresa": source.source_name,
                "valor_esperado": float(source.expected_amount) if source.expected_amount else None,
                "valor_variavel": source.is_variable,
                "frequencia": source.frequency,
                "dia_pagamento": source.payment_day,
                "usa_dia_util": source.use_business_day,
                "numero_dia_util": source.business_day_number,
                "conta_destino": source_account.name if source_account else None,
                "categoria": source_category.name if source_category else None,
                "tributavel": source.is_taxable
            }

            # Adicionar info de beneficio se aplicavel
            if source.type.startswith("benefit_"):
                receita_info["fornecedor_beneficio"] = source.benefit_provider
                receita_info["ultimos_digitos_cartao"] = source.benefit_card_number

            fontes_receita.append(receita_info)

        context["fontes_receita"] = fontes_receita

        return context

    def _build_enhanced_system_prompt(self, context: dict, user_message: str) -> str:
        """Constroi prompt do sistema otimizado para respostas precisas"""
        context_json = json.dumps(context, cls=DecimalEncoder, ensure_ascii=False, indent=2)

        return f"""Voce e o Fin, um consultor financeiro pessoal especializado em analise comportamental de gastos.
Voce TEM ACESSO COMPLETO aos dados financeiros do usuario e DEVE usa-los para fornecer analises ricas e acionaveis.

DADOS FINANCEIROS REAIS DO USUARIO (USE ESTES DADOS!):
{context_json}

PERGUNTA DO USUARIO: "{user_message}"

EXPERTISE E ANALISES QUE VOCE DOMINA:
1. Analise de padroes de comportamento financeiro
2. Identificacao de oportunidades de economia ESPECIFICAS (nao genericas)
3. Estrategias de quitacao de dividas (snowball/avalanche)
4. Otimizacao de uso de cartoes de credito (utilizacao de limite, juros)
5. Analise de tendencias (crescimento/reducao por categoria ao longo do tempo)
6. Identificacao de gastos recorrentes e assinaturas
7. Renegociacao de contratos e reducao de custos fixos

INSTRUCOES CRITICAS PARA RESPOSTAS RICAS:
1. SEMPRE use dados REAIS e especificos dos dados acima
2. Forneca numeros EXATOS e calculos detalhados
3. Ofereça 2-3 opcoes de acao com pros/contras quando relevante
4. Inclua simulacoes de impacto: "Se fizer X, economizara Y" ou "Em 12 meses isso representa Z"
5. Seja empatico mas DIRETO sobre a situacao financeira
6. Identifique padroes: crescimento de gastos, sazonalidade, vazamentos
7. Priorize insights ACIONAVEIS em vez de observacoes genericas

COMO USAR OS DADOS:
- gastos_por_categoria: analise tendencias, compare valores, identifique maiores categorias
- gastos_por_estabelecimento: detecte frequencia, gastos recorrentes, vazamentos
- maiores_gastos: identifique compras atipicas ou oportunidades de negociacao
- cartoes_credito: calcule utilizacao de limite (saldo/limite), alerte se >70%, sugira pagamentos estrategicos
- faturas: identifique faturas vencidas, calcule juros potenciais, sugira priorizacao
- fontes_receita: compare receitas vs despesas, calcule sobra/deficit mensal
- saldo_contas: avalie liquidez, sugira alocacao estrategica de recursos

FORMATO DE RESPOSTAS DETALHADAS:

Sobre reducao de gastos (SEMPRE ESPECIFICO):
❌ Ruim: "Corte despesas desnecessarias"
✅ Bom: "Analisando seus dados, identifiquei 3 oportunidades:

1. **Delivery/Restaurantes (R$ 1.450/mes)**
   - Cresceu 40% nos ultimos meses
   - Frequencia: 18x/mes (media R$ 80/pedido)
   - Reducao sugerida: 2x/semana = economia de R$ 600/mes

2. **Assinaturas (R$ 340/mes)**
   - Detectei X assinaturas recorrentes
   - Oportunidade: cancelar servicos pouco usados = R$ 175/mes

3. **Cartao com maior saldo (R$ X)**
   - Juros estimados: R$ Y/mes
   - Usando R$ 10k para quitar: economia de R$ Z/mes

**Total de economia potencial: R$ X/mes (R$ Y/ano)**"

Sobre cartoes de credito (CALCULE TUDO):
✅ "Analisando seus 3 cartoes:

1. **Carrefour** - ATENCAO!
   - Saldo em aberto: R$ 9.392,07
   - Limite total: R$ 11.000
   - Utilizacao: 85% (ALTO RISCO para score de credito!)
   - Juros estimados se pagar minimo: R$ 1.127/mes
   - **Acao urgente**: Pague R$ 4.000 para reduzir para 50% e proteger seu score

2. **Sam's Club**
   - Saldo: R$ 4.904,53 | Limite: R$ 11.000 (45% usado - OK)
   - Vencimento: [data]

3. **Itau Pao de Acucar**
   - Saldo: R$ 10.206,69 | Limite: R$ 12.000 (85% - ALERTA!)

**Total em divida:** R$ 24.503,29
**Juros mensais projetados:** ~R$ 2.940 (taxa media 12% a.m.)

**Estrategia sugerida com seus R$ 45.000 disponiveis:**
- Use R$ 10.000 para quitar Carrefour e reduzir Itau
- Isso eliminaria R$ 1.800/mes em juros
- Libera R$ 21.000 em limite para emergencias"

Sobre analise de tendencias:
✅ "Comparando ultimos 3 meses:
- Alimentacao: R$ 800 → R$ 950 → R$ 1.200 (+50% em 3 meses!)
- Transporte: R$ 450 → R$ 420 → R$ 380 (reducao de 15% - parabens!)
- Lazer: Estavel em ~R$ 300/mes

**Alerta:** Alimentacao crescendo R$ 200/mes. Se continuar, chegara a R$ 1.600 em 3 meses.
**Acao:** Revisar compras de supermercado e delivery. Reduzir delivery para 2x/semana economizaria R$ 400/mes."

NUNCA faca respostas genericas como:
❌ "Voce deveria economizar mais"
❌ "Tente reduzir gastos com restaurantes"
❌ "Seus cartoes estao altos"

SEMPRE inclua:
✅ Valores especificos dos dados reais
✅ Calculos e impacto financeiro
✅ Opcoes de acao concretas
✅ Simulacoes de economia
✅ Priorizacao (o que fazer primeiro)

Termine sempre com uma pergunta ou proxima acao especifica."""

    async def _call_llm(self, system_prompt: str, messages: list[dict]) -> str:
        """Chama o LLM configurado (Google ou Mistral)"""
        try:
            if self.provider == "google":
                return await self._call_google(system_prompt, messages)
            elif self.provider == "mistral":
                return await self._call_mistral(system_prompt, messages)
            else:
                return "Desculpe, nenhum provider de IA esta configurado. Configure GOOGLE_API_KEY ou MISTRAL_API_KEY e defina VISION_PROVIDER."
        except Exception as e:
            return f"Desculpe, ocorreu um erro ao processar sua mensagem: {str(e)}"

    async def _call_google(self, system_prompt: str, messages: list[dict]) -> str:
        """Chama Google Gemini API"""
        api_key = settings.google_api_key
        if not api_key:
            return "Configure GOOGLE_API_KEY no arquivo .env para usar o assistente."

        contents = []
        contents.append({
            "role": "user",
            "parts": [{"text": system_prompt}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": "Entendido! Sou o Fin e vou analisar os dados financeiros fornecidos para dar respostas precisas e personalizadas."}]
        })

        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })

        model = "gemini-2.0-flash"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                json={
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.4,
                        "maxOutputTokens": 2000,
                    }
                },
            )

            if response.status_code != 200:
                return f"Erro na API do Google: {response.status_code}"

            result = response.json()
            return result["candidates"][0]["content"]["parts"][0]["text"]

    async def _call_mistral(self, system_prompt: str, messages: list[dict]) -> str:
        """Chama Mistral AI API"""
        api_key = settings.mistral_api_key
        if not api_key:
            return "Configure MISTRAL_API_KEY no arquivo .env para usar o assistente."

        mistral_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            mistral_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": mistral_messages,
                    "max_tokens": 2000,
                    "temperature": 0.4,
                },
            )

            if response.status_code != 200:
                return f"Erro na API da Mistral: {response.status_code} - {response.text}"

            result = response.json()
            return result["choices"][0]["message"]["content"]

    def _generate_smart_suggestions(self, message: str, context: dict) -> list[str]:
        """Gera sugestoes inteligentes baseadas no contexto"""
        suggestions = []
        message_lower = message.lower()

        # Se falou de gastos, sugerir detalhamento
        if "gast" in message_lower:
            if context.get("gastos_por_categoria"):
                top_cat = list(context["gastos_por_categoria"].keys())[0] if context["gastos_por_categoria"] else None
                if top_cat:
                    suggestions.append(f"Detalhe meus gastos com {top_cat}")

        # Se tem cartoes, sugerir analise
        if context.get("cartoes_credito"):
            cartoes = context["cartoes_credito"]
            # Verificar se tem faturas vencidas
            has_overdue = any(
                fatura.get("vencida") for cartao in cartoes
                for fatura in cartao.get("faturas", [])
            )
            if has_overdue and "venc" not in message_lower:
                suggestions.append("Quais faturas estao vencidas?")

            # Verificar limite baixo (menos de 30% disponível)
            for cartao in cartoes:
                if cartao.get("limite_total", 0) > 0:
                    percentual_usado = (cartao.get("saldo_em_aberto", 0) / cartao["limite_total"]) * 100
                    if percentual_usado > 70 and "limite" not in message_lower:
                        suggestions.append("Qual meu limite disponivel nos cartoes?")
                        break

        # Se tem receitas configuradas, sugerir analise
        if context.get("fontes_receita") and "receita" not in message_lower and "salario" not in message_lower:
            suggestions.append("Quando recebo minhas proximas receitas?")

        # Se tem dividas, sugerir estrategia
        if context.get("dividas") and "divid" not in message_lower:
            suggestions.append("Qual estrategia para quitar minhas dividas?")

        # Se tem metas, sugerir acompanhamento
        if context.get("metas") and "meta" not in message_lower:
            suggestions.append("Como estao minhas metas?")

        # Se falou de mes especifico, sugerir comparacao
        if any(m in message_lower for m in self.MONTHS_PT.keys()):
            suggestions.append("Compare com o mes anterior")

        # Sugestoes gerais baseadas nos dados
        resumo = context.get("resumo_periodo", {})
        if resumo.get("despesas", 0) > resumo.get("receitas", 0):
            suggestions.append("Como equilibrar minhas financas?")

        comparacao = context.get("comparacao_mes_anterior", {})
        if comparacao.get("variacao_despesas", 0) > 10:
            suggestions.append("Por que meus gastos aumentaram?")

        # Sugestoes padrao
        default_suggestions = [
            "Analise minha saude financeira",
            "Quanto devo guardar por mes?",
            "Quais gastos posso reduzir?",
        ]

        # Combinar e limitar
        all_suggestions = suggestions + default_suggestions
        seen = set()
        unique = []
        for s in all_suggestions:
            if s.lower() not in seen:
                seen.add(s.lower())
                unique.append(s)

        return unique[:4]

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

    # Public methods for external use
    async def get_suggestions_context(self, user: User, query_context: dict) -> dict:
        """Public wrapper for getting context for suggestions"""
        return await self._get_comprehensive_context(user, query_context)

    def generate_smart_suggestions(self, message: str, context: dict) -> list[str]:
        """Public wrapper for generating suggestions"""
        return self._generate_smart_suggestions(message, context)
