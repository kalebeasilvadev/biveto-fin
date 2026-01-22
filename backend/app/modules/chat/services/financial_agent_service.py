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
from sqlalchemy import select, func, and_, or_, delete
from collections import defaultdict

from app.core.config import settings
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.models.merchant import Merchant
from app.models.debt import Debt, DebtStatus, DebtPayment
from app.models.goal import Goal, GoalContribution
from app.models.budget import Budget, BudgetItem
from app.models.account import Account
from app.models.household import HouseholdMember
from app.models.credit_card import CreditCard
from app.models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from app.models.income_source import IncomeSource
from app.models.chat import ChatConversation, ChatMessage, MessageRole
from app.models.installment import InstallmentSeries, InstallmentSeriesStatus
from app.models.recurring import RecurringTransaction, RecurringStatus
from app.models.benefit_card import BenefitCard
from app.models.grocery import (
    GroceryPurchase, GroceryProduct, ShoppingList, ShoppingListItem,
    GroceryPriceHistory, ShoppingListStatus, GROCERY_CATEGORY_DISPLAY
)
from app.models.envelope import SpendingEnvelope, EnvelopeHistory, EnvelopeStatus
from app.models.automation_rule import AutomationRule, AutomationExecution
from app.modules.chat.schemas.chat import ChatResponse

# Limite de mensagens por conversa para evitar vazamento de memória
MAX_MESSAGES_PER_CONVERSATION = 10


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

    # Domínios válidos para classificação
    VALID_DOMAINS = [
        "cartoes",      # Cartões de crédito, faturas, limites, parcelas no cartão
        "mercado",      # Compras de supermercado, produtos, preços, listas de compras
        "dividas",      # Dívidas, empréstimos, financiamentos, juros, quitação
        "orcamento",    # Orçamento mensal, limites por categoria, gastos vs planejado
        "metas",        # Metas financeiras, objetivos, PNIF, fundo de emergência
        "recorrentes",  # Assinaturas, Netflix, Spotify, contas fixas mensais
        "fluxo",        # Fluxo de caixa, quando recebo, saldo futuro, projeções
        "beneficios",   # VA, VR, VT, vale alimentação, vale refeição
        "envelopes",    # Envelope budgeting, limites diários, gastos por envelope
        "calendario",   # Calendário financeiro, projeções, vencimentos futuros
        "revisao",      # Weekly review, análise semanal, transações sem categoria
        "automacoes",   # Automações, regras automáticas, transferências programadas
        "geral",        # Visão geral, resumo, saúde financeira
    ]

    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = settings.vision_provider

    # ========== ROUTER/COORDENADOR: Classificação de Intent ==========

    async def _classify_intent_with_llm(self, message: str, history: list[dict] | None = None) -> list[str]:
        """Usa LLM para classificar domínios relevantes da pergunta do usuário

        Args:
            message: Mensagem atual do usuário
            history: Histórico da conversa (últimas mensagens) para contexto
        """
        # Construir contexto do histórico se disponível
        history_context = ""
        if history and len(history) > 0:
            # Pegar últimas 4 mensagens (2 trocas user/assistant)
            recent_messages = history[-4:]
            history_lines = []
            for msg in recent_messages:
                role = "Usuário" if msg.get("role") == "user" else "Assistente"
                content = msg.get("content", "")[:300]  # Limitar tamanho
                history_lines.append(f"{role}: {content}")
            history_context = "\n".join(history_lines)

        classification_prompt = f"""Classifique a pergunta do usuário nos domínios financeiros relevantes.

DOMÍNIOS DISPONÍVEIS:
- cartoes: cartões de crédito, faturas, limites, parcelas no cartão, fatura vencida, quitar cartão
- mercado: compras de supermercado, produtos, preços, listas de compras, mercado
- dividas: dívidas, empréstimos, financiamentos, juros, quitação, snowball, avalanche
- orcamento: orçamento mensal, limites por categoria, gastos vs planejado, estourou
- metas: metas financeiras, objetivos, PNIF, fundo de emergência, guardar dinheiro
- recorrentes: assinaturas, Netflix, Spotify, contas fixas mensais, recorrentes
- fluxo: fluxo de caixa, quando recebo, saldo futuro, projeções de receita, saldo disponível
- beneficios: VA, VR, VT, vale alimentação, vale refeição, benefício
- envelopes: envelope budgeting, limite diário, quanto posso gastar hoje, envelopes
- calendario: calendário financeiro, vencimentos futuros, próximos pagamentos, agenda
- revisao: review semanal, análise da semana, transações sem categoria, o que mudou
- automacoes: automações, regras automáticas, transferências programadas, robôs
- geral: visão geral, resumo, saúde financeira, impacto financeiro, planejamento

{"CONTEXTO DA CONVERSA (mensagens anteriores):" + chr(10) + history_context + chr(10) if history_context else ""}
MENSAGEM ATUAL DO USUÁRIO: "{message}"

REGRAS DE CLASSIFICAÇÃO:
1. Se a mensagem for curta (sim, não, quero, ok, etc.), USE O CONTEXTO DA CONVERSA para entender o assunto
2. Se a conversa anterior falava de cartões e o usuário confirma algo, mantenha "cartoes"
3. Se o usuário quer "avaliar impacto" ou "planejamento", adicione "fluxo" e/ou "geral" junto com o domínio principal
4. Se envolver múltiplos domínios específicos, liste todos (máximo 3)

Responda APENAS com os domínios separados por vírgula, sem explicação.
Exemplos: "cartoes,fluxo" ou "geral" ou "mercado" ou "cartoes,geral"."""

        try:
            response = await self._call_classification_llm(classification_prompt)

            # Parse da resposta - extrair apenas palavras válidas
            response_clean = response.lower().strip()
            # Remover caracteres especiais e extrair palavras
            domains = [d.strip().strip('"\'.,') for d in response_clean.split(",")]
            domains = [d for d in domains if d in self.VALID_DOMAINS]

            return domains if domains else ["geral"]
        except Exception:
            # Fallback para classificação por keywords se LLM falhar
            # Se mensagem é curta e temos histórico, tentar extrair domínio do histórico
            if history and len(message.strip()) < 15:
                return self._classify_from_history(history)
            return self._classify_intent_by_keywords(message)

    def _classify_from_history(self, history: list[dict]) -> list[str]:
        """Extrai domínios do histórico quando a mensagem atual é muito curta"""
        # Concatenar últimas mensagens do histórico
        recent_text = " ".join([
            msg.get("content", "")
            for msg in history[-4:]
            if msg.get("role") == "user"
        ])
        return self._classify_intent_by_keywords(recent_text)

    async def _call_classification_llm(self, prompt: str) -> str:
        """Chama LLM pequeno para classificação (baixo custo, rápido)"""
        # Usar Gemini 2.0 Flash-Lite para classificação (mais rápido e barato)
        api_key = settings.google_api_key
        if not api_key:
            raise ValueError("Google API key not configured")

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key={api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0, "maxOutputTokens": 50}
                }
            )
            if response.status_code != 200:
                raise ValueError(f"API error: {response.status_code}")
            result = response.json()
            return result["candidates"][0]["content"]["parts"][0]["text"]

    def _classify_intent_by_keywords(self, message: str) -> list[str]:
        """Fallback: classifica por keywords se LLM falhar"""
        message_lower = message.lower()
        domains = []

        # Mapeamento de keywords para domínios
        keyword_map = {
            "cartoes": ["cartao", "cartão", "fatura", "limite", "credito", "crédito", "bandeira", "visa", "master", "elo"],
            "mercado": ["mercado", "supermercado", "compras", "produto", "lista de compras", "groceries", "feira", "hortifruti"],
            "dividas": ["divida", "dívida", "emprestimo", "empréstimo", "financiamento", "juros", "quitacao", "quitação", "snowball", "avalanche"],
            "orcamento": ["orcamento", "orçamento", "planejado", "categoria", "estourei", "estourou", "limite de gasto"],
            "metas": ["meta", "objetivo", "pnif", "fundo de emergencia", "emergência", "guardar", "economizar", "poupar"],
            "recorrentes": ["assinatura", "netflix", "spotify", "recorrente", "mensal fixo", "streaming", "amazon prime", "icloud"],
            "fluxo": ["fluxo", "quando recebo", "salario", "salário", "receita", "projecao", "projeção"],
            "beneficios": ["va", "vr", "vt", "vale alimentacao", "vale alimentação", "vale refeicao", "vale refeição", "beneficio", "benefício", "alelo", "sodexo"],
            "envelopes": ["envelope", "limite diario", "limite diário", "quanto posso gastar", "diaria", "diária", "ynab"],
            "calendario": ["calendario", "calendário", "agenda", "vencimento", "proximo pagamento", "próximo pagamento", "quando vence"],
            "revisao": ["review", "revisao", "revisão", "semana passada", "essa semana", "sem categoria", "categorizar", "o que mudou"],
            "automacoes": ["automacao", "automação", "automatico", "automático", "regra", "robo", "robô", "transferencia programada", "transferência programada"],
            "geral": ["resumo", "geral", "financas", "finanças", "como estou", "situacao", "situação", "saude financeira", "saúde financeira"],
        }

        for domain, keywords in keyword_map.items():
            if any(kw in message_lower for kw in keywords):
                domains.append(domain)

        # Se não encontrou nenhum, usar geral
        return domains[:3] if domains else ["geral"]

    # ========== ROTEAMENTO DE CONTEXTO POR DOMÍNIO ==========

    async def _get_domain_context(self, user: User, domains: list[str], query_context: dict[str, Any]) -> dict[str, Any]:
        """Busca apenas os dados relevantes para os domínios identificados"""
        context: dict[str, Any] = {}

        # Dados básicos sempre incluídos
        household_user_ids = await self._get_household_user_ids(user)
        today = date.today()
        period = query_context.get("period") or {}
        period_start = period.get("start", date(today.year, today.month, 1))
        period_end = period.get("end", today)
        period_label = period.get("label", "Periodo selecionado")

        context["periodo_analise"] = {
            "label": period_label,
            "inicio": period_start.strftime("%d/%m/%Y"),
            "fim": period_end.strftime("%d/%m/%Y"),
        }

        # Buscar contexto específico para cada domínio
        if "cartoes" in domains:
            context["cartoes"] = await self._get_credit_card_expert_context(user)

        if "mercado" in domains:
            context["mercado"] = await self._get_grocery_expert_context(user, period_start, period_end, household_user_ids)

        if "dividas" in domains:
            context["dividas"] = await self._get_debt_expert_context(user)

        if "orcamento" in domains:
            context["orcamento"] = await self._get_budget_expert_context(user, period_start, period_end)

        if "metas" in domains:
            context["metas"] = await self._get_goals_expert_context(user)

        if "recorrentes" in domains:
            context["recorrentes"] = await self._get_recurring_expert_context(user)

        if "fluxo" in domains:
            context["fluxo"] = await self._get_cashflow_expert_context(user, period_start, period_end, household_user_ids)

        if "beneficios" in domains:
            context["beneficios"] = await self._get_benefits_expert_context(user)

        if "envelopes" in domains:
            context["envelopes"] = await self._get_envelopes_expert_context(user)

        if "calendario" in domains:
            context["calendario"] = await self._get_calendar_expert_context(user, household_user_ids)

        if "revisao" in domains:
            context["revisao"] = await self._get_review_expert_context(user, period_start, period_end)

        if "automacoes" in domains:
            context["automacoes"] = await self._get_automations_expert_context(user)

        if "geral" in domains:
            context["geral"] = await self._get_general_expert_context(user, period_start, period_end, household_user_ids)

        return context

    # ========== CONTEXTOS ESPECIALIZADOS POR DOMÍNIO ==========

    async def _get_credit_card_expert_context(self, user: User) -> dict[str, Any]:
        """Contexto detalhado para o especialista de cartões"""
        # Buscar cartões ativos
        credit_cards_result = await self.db.execute(
            select(CreditCard).where(
                CreditCard.user_id == user.id,
                CreditCard.is_active == True
            )
        )
        credit_cards_list = credit_cards_result.scalars().all()

        # Buscar parcelas ativas para vincular aos cartões
        installments_result = await self.db.execute(
            select(InstallmentSeries).where(
                InstallmentSeries.user_id == user.id,
                InstallmentSeries.status == InstallmentSeriesStatus.ACTIVE.value
            )
        )
        all_installments = installments_result.scalars().all()

        cartoes_info = []
        total_em_aberto = 0

        for card in credit_cards_list:
            # Buscar faturas abertas (OPEN) e próximas a vencer (CLOSED)
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

            # Calcular saldo em aberto
            saldo_em_aberto = sum(
                float(inv.remaining_amount)
                for inv in invoices_list
                if inv.status != InvoiceStatus.PAID.value
            )
            total_em_aberto += saldo_em_aberto

            # Buscar conta vinculada para pegar o nome
            account_result = await self.db.execute(
                select(Account).where(Account.id == card.account_id)
            )
            account = account_result.scalar_one_or_none()
            card_name = account.name if account else "Cartão"

            # Filtrar parcelas vinculadas a este cartão
            parcelas_do_cartao = [
                {
                    "descricao": s.description,
                    "valor_parcela": float(s.installment_amount),
                    "parcelas_restantes": s.installment_count - s.paid_count,
                    "valor_restante_total": float(s.installment_amount * (s.installment_count - s.paid_count))
                }
                for s in all_installments
                if s.credit_card_id == card.id
            ]

            # Calcular impacto mensal = fatura atual + parcelas do cartão
            fatura_atual = invoices_list[0].remaining_amount if invoices_list else 0
            parcelas_mes = sum(p["valor_parcela"] for p in parcelas_do_cartao)
            impacto_mensal = float(fatura_atual) + parcelas_mes

            faturas_info = []
            for inv in invoices_list[:3]:
                faturas_info.append({
                    "periodo": inv.period_display,
                    "status": inv.status,
                    "valor_total": float(inv.total_amount),
                    "valor_restante": float(inv.remaining_amount),
                    "vencimento": inv.due_date.strftime("%d/%m/%Y"),
                    "vencida": inv.is_overdue
                })

            # Calcular utilização do limite
            utilizacao_limite = round((saldo_em_aberto / float(card.credit_limit)) * 100, 1) if card.credit_limit > 0 else 0

            cartoes_info.append({
                "nome": card_name,
                "bandeira": card.card_brand,
                "ultimos_digitos": card.last_four_digits,
                "limite_total": float(card.credit_limit),
                "saldo_em_aberto": saldo_em_aberto,
                "limite_disponivel": float(card.credit_limit) - saldo_em_aberto,
                "utilizacao_limite_percentual": utilizacao_limite,
                "dia_fechamento": card.closing_day,
                "dia_vencimento": card.due_day,
                "faturas": faturas_info,
                "parcelas_vinculadas": parcelas_do_cartao,
                "impacto_mensal": impacto_mensal
            })

        # Ordenar por impacto mensal (maior primeiro)
        cartoes_info.sort(key=lambda c: c["impacto_mensal"], reverse=True)

        return {
            "cartoes": cartoes_info,
            "total_em_aberto": total_em_aberto,
            "cartao_maior_impacto": cartoes_info[0] if cartoes_info else None,
            "quantidade_cartoes": len(cartoes_info),
            "cartoes_com_limite_apertado": [c for c in cartoes_info if c["utilizacao_limite_percentual"] > 70]
        }

    async def _get_grocery_expert_context(self, user: User, period_start: date, period_end: date, household_user_ids: list[int]) -> dict[str, Any]:
        """Contexto detalhado para o especialista de mercado/compras"""
        # Buscar compras de mercado do período
        if household_user_ids:
            purchases_query = select(GroceryPurchase).where(
                GroceryPurchase.purchase_date >= period_start,
                GroceryPurchase.purchase_date <= period_end,
                or_(
                    and_(GroceryPurchase.user_id == user.id, GroceryPurchase.ownership_type == "personal"),
                    and_(GroceryPurchase.user_id.in_(household_user_ids), GroceryPurchase.ownership_type == "household")
                )
            )
        else:
            purchases_query = select(GroceryPurchase).where(
                GroceryPurchase.user_id == user.id,
                GroceryPurchase.purchase_date >= period_start,
                GroceryPurchase.purchase_date <= period_end
            )

        purchases_result = await self.db.execute(purchases_query)
        purchases = purchases_result.scalars().all()

        # Buscar merchant names
        merchant_ids = list(set(p.merchant_id for p in purchases if p.merchant_id))
        merchants: dict[int, str] = {}
        if merchant_ids:
            merchants_result = await self.db.execute(
                select(Merchant).where(Merchant.id.in_(merchant_ids))
            )
            merchants = {m.id: m.name for m in merchants_result.scalars().all()}

        # Calcular totais
        total_gasto = sum(float(p.total_price) for p in purchases)
        total_itens = len(purchases)

        # Gastos por categoria de mercado
        gastos_por_categoria: dict[str, float] = defaultdict(float)
        for p in purchases:
            cat_display = GROCERY_CATEGORY_DISPLAY.get(p.category, p.category)
            gastos_por_categoria[cat_display] += float(p.total_price)

        # Gastos por estabelecimento
        gastos_por_estabelecimento: dict[str, dict] = defaultdict(lambda: {"total": 0, "itens": 0})
        for p in purchases:
            merchant_name = merchants.get(p.merchant_id, "Desconhecido") if p.merchant_id else "Desconhecido"
            gastos_por_estabelecimento[merchant_name]["total"] += float(p.total_price)
            gastos_por_estabelecimento[merchant_name]["itens"] += 1

        # Produtos mais comprados (por frequência)
        produtos_frequentes: dict[str, int] = defaultdict(int)
        for p in purchases:
            produtos_frequentes[p.product_name] += 1

        produtos_top = sorted(produtos_frequentes.items(), key=lambda x: x[1], reverse=True)[:10]

        # Buscar listas de compras ativas
        if user.license_id:
            lists_query = select(ShoppingList).where(
                ShoppingList.license_id == user.license_id,
                ShoppingList.status.in_([ShoppingListStatus.DRAFT.value, ShoppingListStatus.ACTIVE.value])
            )
        else:
            lists_query = select(ShoppingList).where(
                ShoppingList.user_id == user.id,
                ShoppingList.status.in_([ShoppingListStatus.DRAFT.value, ShoppingListStatus.ACTIVE.value])
            )

        lists_result = await self.db.execute(lists_query)
        shopping_lists = lists_result.scalars().all()

        listas_ativas = []
        for lst in shopping_lists:
            # Buscar itens da lista
            items_result = await self.db.execute(
                select(ShoppingListItem).where(ShoppingListItem.list_id == lst.id)
            )
            items = items_result.scalars().all()
            listas_ativas.append({
                "nome": lst.name,
                "status": lst.status,
                "total_itens": len(items),
                "itens_marcados": sum(1 for i in items if i.is_checked),
                "valor_estimado": sum(float(i.estimated_price or 0) * float(i.quantity) for i in items)
            })

        # Calcular média por compra
        compras_unicas = len(set((p.purchase_date, p.merchant_id) for p in purchases))
        media_por_compra = total_gasto / compras_unicas if compras_unicas > 0 else 0

        return {
            "total_gasto_mercado": total_gasto,
            "total_itens_comprados": total_itens,
            "quantidade_compras": compras_unicas,
            "media_por_compra": round(media_por_compra, 2),
            "gastos_por_categoria": dict(sorted(gastos_por_categoria.items(), key=lambda x: x[1], reverse=True)),
            "gastos_por_estabelecimento": dict(sorted(gastos_por_estabelecimento.items(), key=lambda x: x[1]["total"], reverse=True)[:5]),
            "produtos_mais_comprados": [{"produto": p[0], "vezes": p[1]} for p in produtos_top],
            "listas_de_compras_ativas": listas_ativas
        }

    async def _get_debt_expert_context(self, user: User) -> dict[str, Any]:
        """Contexto detalhado para o especialista de dívidas"""
        result = await self.db.execute(
            select(Debt).where(
                Debt.user_id == user.id,
                Debt.status == DebtStatus.ACTIVE.value
            ).order_by(Debt.current_balance.asc())
        )
        debts = result.scalars().all()

        if not debts:
            return {"tem_dividas": False, "dividas": [], "total_dividas": 0}

        # Buscar pagamentos recentes
        debt_ids = [d.id for d in debts]
        payments_result = await self.db.execute(
            select(DebtPayment).where(
                DebtPayment.debt_id.in_(debt_ids)
            ).order_by(DebtPayment.payment_date.desc()).limit(10)
        )
        recent_payments = payments_result.scalars().all()

        # Calcular totais
        total_dividas = sum(float(d.current_balance) for d in debts)
        total_minimo = sum(float(d.minimum_payment) for d in debts)
        total_juros_mensal = sum(
            float(d.current_balance) * (float(d.interest_rate) / 100)
            for d in debts
            if d.interest_type == "monthly"
        )

        dividas_info = []
        for d in debts:
            dividas_info.append({
                "nome": d.name,
                "tipo": d.type,
                "saldo_atual": float(d.current_balance),
                "taxa_juros": float(d.interest_rate),
                "tipo_juros": d.interest_type,
                "pagamento_minimo": float(d.minimum_payment),
                "juros_mensal_estimado": float(d.current_balance) * (float(d.interest_rate) / 100) if d.interest_type == "monthly" else 0
            })

        # Ordenar para estratégias
        dividas_por_saldo = sorted(dividas_info, key=lambda x: x["saldo_atual"])
        dividas_por_juros = sorted(dividas_info, key=lambda x: x["taxa_juros"], reverse=True)

        # Estimar meses para quitar
        meses_estimados = int(total_dividas / total_minimo) + 1 if total_minimo > 0 else 0

        return {
            "tem_dividas": True,
            "dividas": dividas_info,
            "total_dividas": total_dividas,
            "total_pagamento_minimo": total_minimo,
            "juros_mensal_estimado": round(total_juros_mensal, 2),
            "quantidade_dividas": len(debts),
            "meses_para_quitar_estimado": meses_estimados,
            "estrategia_snowball": {
                "ordem": [d["nome"] for d in dividas_por_saldo],
                "primeira_divida": dividas_por_saldo[0] if dividas_por_saldo else None,
                "descricao": "Quitar a menor dívida primeiro para ganhar motivação"
            },
            "estrategia_avalanche": {
                "ordem": [d["nome"] for d in dividas_por_juros],
                "primeira_divida": dividas_por_juros[0] if dividas_por_juros else None,
                "descricao": "Quitar a de maior juros primeiro para economizar dinheiro"
            },
            "recomendacao": "avalanche" if dividas_por_juros and dividas_por_juros[0]["taxa_juros"] > 5 else "snowball",
            "pagamentos_recentes": [
                {"valor": float(p.amount), "data": p.payment_date.strftime("%d/%m/%Y")}
                for p in recent_payments[:5]
            ]
        }

    async def _get_budget_expert_context(self, user: User, period_start: date, period_end: date) -> dict[str, Any]:
        """Contexto detalhado para o especialista de orçamento"""
        today = date.today()

        # Buscar orçamento do mês
        budget_result = await self.db.execute(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.year == today.year,
                Budget.month == today.month
            )
        )
        budget = budget_result.scalar_one_or_none()

        if not budget:
            return {
                "tem_orcamento": False,
                "mensagem": "Sem orçamento definido para este mês"
            }

        # Buscar itens do orçamento
        items_result = await self.db.execute(
            select(BudgetItem).where(BudgetItem.budget_id == budget.id)
        )
        budget_items = items_result.scalars().all()

        # Buscar categorias
        category_ids = [b.category_id for b in budget_items if b.category_id]
        categories: dict[int | None, str] = {}
        if category_ids:
            cat_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories = {c.id: c.name for c in cat_result.scalars().all()}

        # Buscar gastos reais do mês
        start_date = date(today.year, today.month, 1)
        result = await self.db.execute(
            select(
                Transaction.category_id,
                func.sum(Transaction.amount).label('total')
            ).where(
                Transaction.user_id == user.id,
                Transaction.type == TransactionType.EXPENSE.value,
                Transaction.date >= start_date,
                Transaction.date <= today
            ).group_by(Transaction.category_id)
        )
        gastos_por_categoria = {row.category_id: float(row.total) for row in result.all()}

        # Analisar cada item do orçamento
        orcamento_items = []
        categorias_alerta = []
        categorias_estouradas = []
        total_planejado = 0
        total_gasto = 0

        for item in budget_items:
            planejado = float(item.planned_amount)
            gasto = gastos_por_categoria.get(item.category_id, 0)
            cat_name = categories.get(item.category_id, "Categoria")
            total_planejado += planejado
            total_gasto += gasto

            percentual = round((gasto / planejado) * 100, 1) if planejado > 0 else 0
            restante = planejado - gasto

            item_info = {
                "categoria": cat_name,
                "planejado": planejado,
                "gasto": gasto,
                "restante": restante,
                "percentual_usado": percentual
            }
            orcamento_items.append(item_info)

            if percentual >= 100:
                categorias_estouradas.append(item_info)
            elif percentual >= 80:
                categorias_alerta.append(item_info)

        # Calcular score (0-100)
        score = 100.0
        if total_planejado > 0:
            percentual_total = (total_gasto / total_planejado) * 100
            if percentual_total > 100:
                score = max(0, 100 - (percentual_total - 100) * 2)
            elif percentual_total > 80:
                score = 100 - (percentual_total - 80)

        # Calcular orçamento diário restante
        dias_restantes = (date(today.year, today.month + 1 if today.month < 12 else 1, 1) - timedelta(days=1) - today).days
        orcamento_diario_restante = (total_planejado - total_gasto) / max(1, dias_restantes)

        return {
            "tem_orcamento": True,
            "score_saude": round(score, 1),
            "total_planejado": total_planejado,
            "total_gasto": total_gasto,
            "total_restante": total_planejado - total_gasto,
            "percentual_usado": round((total_gasto / total_planejado * 100), 1) if total_planejado > 0 else 0,
            "dias_restantes_no_mes": dias_restantes,
            "orcamento_diario_restante": round(orcamento_diario_restante, 2),
            "itens_orcamento": orcamento_items,
            "categorias_em_alerta": categorias_alerta,
            "categorias_estouradas": categorias_estouradas
        }

    async def _get_goals_expert_context(self, user: User) -> dict[str, Any]:
        """Contexto detalhado para o especialista de metas"""
        goals_result = await self.db.execute(
            select(Goal).where(
                Goal.user_id == user.id,
                Goal.status == "active"
            )
        )
        goals = goals_result.scalars().all()

        metas_info = []
        total_alvo = 0
        total_atual = 0

        for g in goals:
            progresso = round(float(g.current_amount / g.target_amount * 100), 1) if g.target_amount > 0 else 0
            falta = float(g.target_amount - g.current_amount)
            total_alvo += float(g.target_amount)
            total_atual += float(g.current_amount)

            # Calcular contribuição mensal necessária
            contribuicao_mensal = None
            meses_restantes = None
            if g.target_date:
                today = date.today()
                meses_restantes = max(1, (g.target_date.year - today.year) * 12 + (g.target_date.month - today.month))
                contribuicao_mensal = round(falta / meses_restantes, 2) if falta > 0 else 0

            metas_info.append({
                "nome": g.name,
                "valor_alvo": float(g.target_amount),
                "valor_atual": float(g.current_amount),
                "progresso_percentual": progresso,
                "falta": falta,
                "prazo": g.target_date.strftime("%d/%m/%Y") if g.target_date else None,
                "meses_restantes": meses_restantes,
                "contribuicao_mensal_necessaria": contribuicao_mensal
            })

        # Buscar contribuições recentes
        goal_ids = [g.id for g in goals]
        contributions = []
        if goal_ids:
            contrib_result = await self.db.execute(
                select(GoalContribution).where(
                    GoalContribution.goal_id.in_(goal_ids)
                ).order_by(GoalContribution.contribution_date.desc()).limit(5)
            )
            contributions = [
                {"valor": float(c.amount), "data": c.contribution_date.strftime("%d/%m/%Y")}
                for c in contrib_result.scalars().all()
            ]

        return {
            "metas": metas_info,
            "quantidade_metas": len(metas_info),
            "total_alvo_todas_metas": total_alvo,
            "total_atual_todas_metas": total_atual,
            "progresso_geral": round((total_atual / total_alvo * 100), 1) if total_alvo > 0 else 0,
            "contribuicoes_recentes": contributions
        }

    async def _get_recurring_expert_context(self, user: User) -> dict[str, Any]:
        """Contexto detalhado para o especialista de recorrentes/assinaturas"""
        result = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user.id,
                RecurringTransaction.status == RecurringStatus.ACTIVE.value,
                RecurringTransaction.type == "expense"
            ).order_by(RecurringTransaction.amount.desc())
        )
        recurring_list = result.scalars().all()

        # Buscar categorias
        category_ids = [r.category_id for r in recurring_list if r.category_id]
        categories: dict[int | None, str] = {}
        if category_ids:
            cat_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories = {c.id: c.name for c in cat_result.scalars().all()}

        # Serviços conhecidos para identificação
        known_services = {
            "netflix": "Streaming",
            "spotify": "Música",
            "amazon": "E-commerce/Streaming",
            "icloud": "Armazenamento",
            "google": "Serviços Google",
            "microsoft": "Software",
            "adobe": "Software",
            "dropbox": "Armazenamento",
            "gym": "Academia",
            "academia": "Academia",
            "disney": "Streaming",
            "hbo": "Streaming",
            "prime": "Streaming",
            "youtube": "Streaming",
        }

        recorrentes = []
        total_mensal = 0
        total_anual = 0

        for r in recurring_list:
            freq_display = {
                "daily": "diário",
                "weekly": "semanal",
                "monthly": "mensal",
                "yearly": "anual"
            }.get(r.frequency, r.frequency)

            # Calcular valor mensal equivalente
            valor_mensal = float(r.amount)
            if r.frequency == "yearly":
                valor_mensal = float(r.amount) / 12
                total_anual += float(r.amount)
            elif r.frequency == "monthly":
                total_mensal += float(r.amount)
            elif r.frequency == "weekly":
                valor_mensal = float(r.amount) * 4.33
                total_mensal += valor_mensal

            # Identificar tipo de serviço
            tipo_servico = None
            name_lower = r.name.lower()
            for service, tipo in known_services.items():
                if service in name_lower:
                    tipo_servico = tipo
                    break

            recorrentes.append({
                "nome": r.name,
                "valor": float(r.amount),
                "valor_mensal_equivalente": round(valor_mensal, 2),
                "frequencia": freq_display,
                "categoria": categories.get(r.category_id, "Sem categoria"),
                "tipo_servico": tipo_servico,
                "proximo_vencimento": r.next_due_date.strftime("%d/%m/%Y") if r.next_due_date else None,
                "dia_do_mes": r.day_of_month
            })

        # Agrupar por tipo de serviço
        por_tipo: dict[str, float] = defaultdict(float)
        for r in recorrentes:
            tipo = r["tipo_servico"] or "Outros"
            por_tipo[tipo] += r["valor_mensal_equivalente"]

        return {
            "assinaturas": recorrentes,
            "quantidade": len(recorrentes),
            "total_mensal": round(total_mensal + total_anual / 12, 2),
            "total_anual_projetado": round((total_mensal * 12) + total_anual, 2),
            "gastos_por_tipo": dict(sorted(por_tipo.items(), key=lambda x: x[1], reverse=True)),
            "possivel_economia": round(sum(r["valor_mensal_equivalente"] for r in recorrentes if r["tipo_servico"] == "Streaming") * 0.3, 2)  # Estimativa: 30% streaming pode ser cortado
        }

    async def _get_cashflow_expert_context(self, user: User, period_start: date, period_end: date, household_user_ids: list[int]) -> dict[str, Any]:
        """Contexto detalhado para o especialista de fluxo de caixa"""
        today = date.today()

        # Buscar fontes de receita
        income_sources_result = await self.db.execute(
            select(IncomeSource).where(
                IncomeSource.user_id == user.id,
                IncomeSource.is_active == True
            )
        )
        income_sources = income_sources_result.scalars().all()

        # Buscar contas
        if household_user_ids:
            accounts_query = select(Account).where(
                or_(
                    and_(Account.user_id == user.id, Account.ownership_type == "personal"),
                    and_(Account.user_id.in_(household_user_ids), Account.ownership_type == "household")
                )
            )
        else:
            accounts_query = select(Account).where(Account.user_id == user.id)

        accounts_result = await self.db.execute(accounts_query)
        accounts = accounts_result.scalars().all()
        saldo_atual = sum(float(a.balance) for a in accounts)

        # Buscar transações do período
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

        tx_result = await self.db.execute(tx_query)
        transactions = tx_result.scalars().all()

        receitas_periodo = sum(float(t.amount) for t in transactions if t.type == TransactionType.INCOME.value)
        despesas_periodo = sum(float(t.amount) for t in transactions if t.type == TransactionType.EXPENSE.value)

        # Calcular próximas receitas esperadas
        proximas_receitas = []
        for source in income_sources:
            if source.expected_amount:
                # Calcular próxima data de pagamento
                if source.payment_day:
                    prox_pagamento = date(today.year, today.month, min(source.payment_day, 28))
                    if prox_pagamento <= today:
                        prox_pagamento = date(
                            today.year + (1 if today.month == 12 else 0),
                            1 if today.month == 12 else today.month + 1,
                            min(source.payment_day, 28)
                        )
                    proximas_receitas.append({
                        "fonte": source.name,
                        "valor_esperado": float(source.expected_amount),
                        "data_prevista": prox_pagamento.strftime("%d/%m/%Y"),
                        "dias_para_receber": (prox_pagamento - today).days
                    })

        # Projeção de saldo para os próximos 30 dias
        receita_mensal_esperada = sum(float(s.expected_amount) for s in income_sources if s.expected_amount)

        # Buscar despesas recorrentes para projeção
        recurring_result = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user.id,
                RecurringTransaction.status == RecurringStatus.ACTIVE.value,
                RecurringTransaction.type == "expense"
            )
        )
        recurring_expenses = recurring_result.scalars().all()
        despesas_recorrentes_mes = sum(
            float(r.amount) for r in recurring_expenses
            if r.frequency == "monthly"
        )

        saldo_projetado_30_dias = saldo_atual + receita_mensal_esperada - despesas_recorrentes_mes

        return {
            "saldo_atual": saldo_atual,
            "contas": [{"nome": a.name, "saldo": float(a.balance)} for a in accounts],
            "receitas_periodo": receitas_periodo,
            "despesas_periodo": despesas_periodo,
            "saldo_periodo": receitas_periodo - despesas_periodo,
            "receita_mensal_esperada": receita_mensal_esperada,
            "despesas_recorrentes_mes": despesas_recorrentes_mes,
            "proximas_receitas": sorted(proximas_receitas, key=lambda x: x["dias_para_receber"]),
            "saldo_projetado_30_dias": round(saldo_projetado_30_dias, 2),
            "fluxo_positivo": receitas_periodo > despesas_periodo
        }

    async def _get_benefits_expert_context(self, user: User) -> dict[str, Any]:
        """Contexto detalhado para o especialista de benefícios"""
        result = await self.db.execute(
            select(BenefitCard).where(
                BenefitCard.user_id == user.id,
                BenefitCard.is_active == True
            )
        )
        benefit_cards = result.scalars().all()

        # Buscar contas vinculadas para obter saldos
        account_ids = [b.account_id for b in benefit_cards]
        accounts: dict[int, Account] = {}
        if account_ids:
            acc_result = await self.db.execute(
                select(Account).where(Account.id.in_(account_ids))
            )
            accounts = {a.id: a for a in acc_result.scalars().all()}

        beneficios = []
        total_saldo = 0
        total_recarga_mensal = 0
        today = date.today()

        for b in benefit_cards:
            account = accounts.get(b.account_id)
            saldo = float(account.balance) if account else 0
            total_saldo += saldo

            recarga = float(b.expected_monthly_recharge) if b.expected_monthly_recharge else 0
            total_recarga_mensal += recarga

            # Calcular próxima recarga
            prox_recarga = None
            dias_para_recarga = None
            if b.recharge_day:
                prox_recarga_date = date(today.year, today.month, min(b.recharge_day, 28))
                if prox_recarga_date <= today:
                    prox_recarga_date = date(
                        today.year + (1 if today.month == 12 else 0),
                        1 if today.month == 12 else today.month + 1,
                        min(b.recharge_day, 28)
                    )
                prox_recarga = prox_recarga_date.strftime("%d/%m/%Y")
                dias_para_recarga = (prox_recarga_date - today).days

            # Calcular média de uso diário (estimativa)
            dias_desde_recarga = today.day if b.recharge_day and today.day > b.recharge_day else today.day + 30 - (b.recharge_day or 1)
            uso_diario_estimado = (recarga - saldo) / max(1, dias_desde_recarga) if recarga > 0 else 0

            beneficios.append({
                "tipo": b.card_type_display,
                "operadora": b.provider_display,
                "ultimos_digitos": b.last_four_digits,
                "saldo_atual": saldo,
                "recarga_esperada": recarga,
                "dia_recarga": b.recharge_day,
                "proxima_recarga": prox_recarga,
                "dias_para_recarga": dias_para_recarga,
                "uso_diario_estimado": round(uso_diario_estimado, 2)
            })

        return {
            "beneficios": beneficios,
            "quantidade": len(beneficios),
            "total_saldo_beneficios": total_saldo,
            "total_recarga_mensal": total_recarga_mensal
        }

    async def _get_general_expert_context(self, user: User, period_start: date, period_end: date, household_user_ids: list[int]) -> dict[str, Any]:
        """Contexto geral/resumo para visão ampla das finanças"""
        # Usar o método existente de contexto completo, mas resumido
        query_context = {"period": {"start": period_start, "end": period_end}}
        full_context = await self._get_comprehensive_context(user, query_context)

        # Extrair resumo
        return {
            "saldo_total": full_context.get("saldo_total", 0),
            "resumo_periodo": full_context.get("resumo_periodo", {}),
            "comparacao_mes_anterior": full_context.get("comparacao_mes_anterior", {}),
            "saude_financeira": full_context.get("saude_financeira", {}),
            "total_dividas": full_context.get("total_dividas", 0),
            "quantidade_metas": len(full_context.get("metas", [])),
            "quantidade_cartoes": len(full_context.get("cartoes_credito", [])),
            "contas": full_context.get("contas", [])
        }

    async def _get_envelopes_expert_context(self, user: User) -> dict[str, Any]:
        """Contexto detalhado para o especialista de envelopes (envelope budgeting)"""
        result = await self.db.execute(
            select(SpendingEnvelope).where(
                SpendingEnvelope.user_id == user.id,
                SpendingEnvelope.is_active == True
            ).order_by(SpendingEnvelope.priority.desc())
        )
        envelopes = result.scalars().all()

        # Buscar categorias para mapeamento
        category_ids = [e.category_id for e in envelopes if e.category_id]
        categories: dict[int | None, str] = {}
        if category_ids:
            cat_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories = {c.id: c.name for c in cat_result.scalars().all()}

        envelopes_info = []
        total_disponivel = 0
        total_limite = 0
        envelopes_estourados = []
        envelopes_alerta = []
        today = date.today()

        for e in envelopes:
            saldo = float(e.current_balance)
            limite = float(e.limit_amount)
            total_disponivel += saldo
            total_limite += limite

            # Calcular percentual usado
            percentual_usado = round(((limite - saldo) / limite) * 100, 1) if limite > 0 else 0

            # Calcular dias restantes no período
            dias_restantes = max(0, (e.period_end_date - today).days)

            # Calcular valor diário disponível
            valor_diario = round(saldo / max(1, dias_restantes), 2) if dias_restantes > 0 else 0

            envelope_info = {
                "nome": e.name,
                "categoria": categories.get(e.category_id, "Geral"),
                "periodo": e.period_type,
                "limite": limite,
                "saldo_disponivel": saldo,
                "percentual_usado": percentual_usado,
                "valor_diario_disponivel": valor_diario,
                "dias_restantes_periodo": dias_restantes,
                "periodo_inicio": e.period_start_date.strftime("%d/%m/%Y"),
                "periodo_fim": e.period_end_date.strftime("%d/%m/%Y"),
                "permite_rollover": e.allow_rollover,
                "rollover_acumulado": float(e.rollover_balance),
                "status": e.status
            }
            envelopes_info.append(envelope_info)

            if e.status == EnvelopeStatus.OVERSPENT.value:
                envelopes_estourados.append(envelope_info)
            elif percentual_usado >= 80:
                envelopes_alerta.append(envelope_info)

        # Calcular valor diário total disponível
        dias_ate_fim_mes = max(1, (date(today.year, today.month + 1 if today.month < 12 else 1, 1) - timedelta(days=1) - today).days)
        valor_diario_total = round(total_disponivel / dias_ate_fim_mes, 2)

        return {
            "envelopes": envelopes_info,
            "quantidade": len(envelopes_info),
            "total_disponivel": total_disponivel,
            "total_limite": total_limite,
            "valor_diario_total_disponivel": valor_diario_total,
            "envelopes_estourados": envelopes_estourados,
            "envelopes_em_alerta": envelopes_alerta,
            "tem_envelopes": len(envelopes_info) > 0
        }

    async def _get_calendar_expert_context(self, user: User, household_user_ids: list[int]) -> dict[str, Any]:
        """Contexto detalhado para o especialista de calendário financeiro"""
        today = date.today()
        end_date = today + timedelta(days=30)  # Próximos 30 dias

        # Buscar faturas de cartão com vencimento próximo
        invoices_result = await self.db.execute(
            select(CreditCardInvoice).where(
                CreditCardInvoice.user_id == user.id,
                CreditCardInvoice.due_date >= today,
                CreditCardInvoice.due_date <= end_date,
                or_(
                    CreditCardInvoice.status == InvoiceStatus.OPEN.value,
                    CreditCardInvoice.status == InvoiceStatus.CLOSED.value
                )
            ).order_by(CreditCardInvoice.due_date)
        )
        invoices = invoices_result.scalars().all()

        # Buscar contas vinculadas aos cartões para nomes
        card_ids = [i.credit_card_id for i in invoices]
        card_names: dict[int, str] = {}
        if card_ids:
            cards_result = await self.db.execute(
                select(CreditCard, Account).join(Account, CreditCard.account_id == Account.id).where(
                    CreditCard.id.in_(card_ids)
                )
            )
            for card, account in cards_result.all():
                card_names[card.id] = account.name

        faturas_proximas = []
        for inv in invoices:
            faturas_proximas.append({
                "cartao": card_names.get(inv.credit_card_id, "Cartão"),
                "periodo": inv.period_display,
                "valor": float(inv.remaining_amount),
                "vencimento": inv.due_date.strftime("%d/%m/%Y"),
                "dias_para_vencer": (inv.due_date - today).days,
                "status": inv.status
            })

        # Buscar despesas recorrentes com próximo vencimento
        recurring_result = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user.id,
                RecurringTransaction.status == RecurringStatus.ACTIVE.value,
                RecurringTransaction.type == "expense",
                RecurringTransaction.next_due_date >= today,
                RecurringTransaction.next_due_date <= end_date
            ).order_by(RecurringTransaction.next_due_date)
        )
        recurrings = recurring_result.scalars().all()

        despesas_proximas = []
        for r in recurrings:
            despesas_proximas.append({
                "nome": r.name,
                "valor": float(r.amount),
                "vencimento": r.next_due_date.strftime("%d/%m/%Y") if r.next_due_date else None,
                "dias_para_vencer": (r.next_due_date - today).days if r.next_due_date else None,
                "frequencia": r.frequency
            })

        # Buscar receitas esperadas (fontes de renda)
        income_result = await self.db.execute(
            select(IncomeSource).where(
                IncomeSource.user_id == user.id,
                IncomeSource.is_active == True
            )
        )
        income_sources = income_result.scalars().all()

        receitas_proximas = []
        for source in income_sources:
            if source.expected_amount and source.payment_day:
                prox_pagamento = date(today.year, today.month, min(source.payment_day, 28))
                if prox_pagamento <= today:
                    prox_pagamento = date(
                        today.year + (1 if today.month == 12 else 0),
                        1 if today.month == 12 else today.month + 1,
                        min(source.payment_day, 28)
                    )
                if prox_pagamento <= end_date:
                    receitas_proximas.append({
                        "fonte": source.name,
                        "valor": float(source.expected_amount),
                        "data_prevista": prox_pagamento.strftime("%d/%m/%Y"),
                        "dias_para_receber": (prox_pagamento - today).days
                    })

        # Buscar pagamentos de dívidas
        debts_result = await self.db.execute(
            select(Debt).where(
                Debt.user_id == user.id,
                Debt.status == DebtStatus.ACTIVE.value,
                Debt.due_day.isnot(None)
            )
        )
        debts = debts_result.scalars().all()

        dividas_proximas = []
        for debt in debts:
            if debt.due_day and debt.minimum_payment > 0:
                prox_pagamento = date(today.year, today.month, min(debt.due_day, 28))
                if prox_pagamento <= today:
                    prox_pagamento = date(
                        today.year + (1 if today.month == 12 else 0),
                        1 if today.month == 12 else today.month + 1,
                        min(debt.due_day, 28)
                    )
                if prox_pagamento <= end_date:
                    dividas_proximas.append({
                        "nome": debt.name,
                        "valor": float(debt.minimum_payment),
                        "vencimento": prox_pagamento.strftime("%d/%m/%Y"),
                        "dias_para_vencer": (prox_pagamento - today).days
                    })

        # Calcular totais
        total_a_pagar = (
            sum(f["valor"] for f in faturas_proximas) +
            sum(d["valor"] for d in despesas_proximas) +
            sum(d["valor"] for d in dividas_proximas)
        )
        total_a_receber = sum(r["valor"] for r in receitas_proximas)

        # Ordenar todos os eventos por data
        todos_eventos = []
        for f in faturas_proximas:
            todos_eventos.append({"tipo": "fatura", "data": f["vencimento"], "dias": f["dias_para_vencer"], "valor": f["valor"], "descricao": f"Fatura {f['cartao']}"})
        for d in despesas_proximas:
            if d["vencimento"]:
                todos_eventos.append({"tipo": "despesa", "data": d["vencimento"], "dias": d["dias_para_vencer"], "valor": d["valor"], "descricao": d["nome"]})
        for r in receitas_proximas:
            todos_eventos.append({"tipo": "receita", "data": r["data_prevista"], "dias": r["dias_para_receber"], "valor": r["valor"], "descricao": r["fonte"]})
        for d in dividas_proximas:
            todos_eventos.append({"tipo": "divida", "data": d["vencimento"], "dias": d["dias_para_vencer"], "valor": d["valor"], "descricao": d["nome"]})

        todos_eventos.sort(key=lambda x: x["dias"])

        return {
            "faturas_proximas": faturas_proximas,
            "despesas_recorrentes_proximas": despesas_proximas,
            "receitas_esperadas": receitas_proximas,
            "dividas_proximas": dividas_proximas,
            "todos_eventos_ordenados": todos_eventos[:15],  # Top 15 mais próximos
            "total_a_pagar_30_dias": total_a_pagar,
            "total_a_receber_30_dias": total_a_receber,
            "saldo_projetado": total_a_receber - total_a_pagar
        }

    async def _get_review_expert_context(self, user: User, period_start: date, period_end: date) -> dict[str, Any]:
        """Contexto detalhado para o especialista de review semanal"""
        today = date.today()

        # Calcular semana atual (ISO)
        week_number = today.isocalendar()[1]
        year = today.year

        # Datas da semana atual
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        # Buscar transações da semana
        result = await self.db.execute(
            select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.date >= week_start,
                Transaction.date <= min(week_end, today)
            )
        )
        week_transactions = result.scalars().all()

        # Calcular totais da semana
        receitas_semana = sum(float(t.amount) for t in week_transactions if t.type == TransactionType.INCOME.value)
        despesas_semana = sum(float(t.amount) for t in week_transactions if t.type == TransactionType.EXPENSE.value)

        # Buscar transações sem categoria
        uncategorized_result = await self.db.execute(
            select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.date >= week_start,
                Transaction.date <= today,
                Transaction.category_id == None
            ).order_by(Transaction.date.desc()).limit(20)
        )
        uncategorized = uncategorized_result.scalars().all()

        transacoes_sem_categoria = [
            {
                "descricao": t.description or "Sem descrição",
                "valor": float(t.amount),
                "data": t.date.strftime("%d/%m/%Y"),
                "tipo": t.type
            }
            for t in uncategorized
        ]

        # Buscar semana anterior para comparação
        prev_week_start = week_start - timedelta(days=7)
        prev_week_end = week_end - timedelta(days=7)

        prev_result = await self.db.execute(
            select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.date >= prev_week_start,
                Transaction.date <= prev_week_end
            )
        )
        prev_transactions = prev_result.scalars().all()

        despesas_semana_anterior = sum(float(t.amount) for t in prev_transactions if t.type == TransactionType.EXPENSE.value)

        # Calcular variação
        variacao_despesas = None
        if despesas_semana_anterior > 0:
            variacao_despesas = round(((despesas_semana - despesas_semana_anterior) / despesas_semana_anterior) * 100, 1)

        # Buscar top categorias da semana
        category_ids = [t.category_id for t in week_transactions if t.category_id and t.type == TransactionType.EXPENSE.value]
        categories: dict[int | None, str] = {}
        if category_ids:
            cat_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories = {c.id: c.name for c in cat_result.scalars().all()}

        gastos_por_categoria: dict[str, float] = defaultdict(float)
        for t in week_transactions:
            if t.type == TransactionType.EXPENSE.value:
                cat_name = categories.get(t.category_id, "Sem categoria")
                gastos_por_categoria[cat_name] += float(t.amount)

        top_categorias = sorted(
            [{"categoria": k, "valor": v} for k, v in gastos_por_categoria.items()],
            key=lambda x: x["valor"],
            reverse=True
        )[:5]

        # Gerar dicas baseadas nos dados
        dicas = []
        if variacao_despesas and variacao_despesas > 20:
            dicas.append(f"Seus gastos aumentaram {variacao_despesas}% em relação à semana passada.")
        if len(transacoes_sem_categoria) > 5:
            dicas.append(f"Você tem {len(transacoes_sem_categoria)} transações sem categoria. Categorize-as para melhor controle.")
        if receitas_semana > despesas_semana:
            dicas.append(f"Semana positiva! Você tem R$ {receitas_semana - despesas_semana:.2f} de saldo.")

        return {
            "semana_numero": week_number,
            "ano": year,
            "periodo_semana": f"{week_start.strftime('%d/%m')} a {week_end.strftime('%d/%m')}",
            "receitas_semana": receitas_semana,
            "despesas_semana": despesas_semana,
            "saldo_semana": receitas_semana - despesas_semana,
            "despesas_semana_anterior": despesas_semana_anterior,
            "variacao_despesas_percentual": variacao_despesas,
            "media_diaria_gastos": round(despesas_semana / max(1, (min(week_end, today) - week_start).days + 1), 2),
            "transacoes_sem_categoria": transacoes_sem_categoria,
            "quantidade_sem_categoria": len(transacoes_sem_categoria),
            "top_categorias_semana": top_categorias,
            "dicas": dicas,
            "total_transacoes_semana": len(week_transactions)
        }

    async def _get_automations_expert_context(self, user: User) -> dict[str, Any]:
        """Contexto detalhado para o especialista de automações"""
        # Buscar regras de automação ativas
        rules_result = await self.db.execute(
            select(AutomationRule).where(
                AutomationRule.user_id == user.id
            ).order_by(AutomationRule.priority.desc())
        )
        rules = rules_result.scalars().all()

        automacoes_ativas = []
        automacoes_inativas = []
        automacoes_com_erro = []

        for rule in rules:
            rule_info = {
                "nome": rule.name,
                "descricao": rule.description,
                "tipo_gatilho": rule.trigger_type,
                "tipo_acao": rule.action_type,
                "configuracao_gatilho": rule.trigger_config,
                "configuracao_acao": rule.action_config,
                "ativa": rule.is_active,
                "ultima_execucao": rule.last_executed_at.strftime("%d/%m/%Y %H:%M") if rule.last_executed_at else None,
                "total_execucoes": rule.execution_count,
                "falhas_consecutivas": rule.consecutive_failures,
                "ultimo_erro": rule.last_error
            }

            if not rule.is_active:
                automacoes_inativas.append(rule_info)
            elif rule.consecutive_failures > 0:
                automacoes_com_erro.append(rule_info)
            else:
                automacoes_ativas.append(rule_info)

        # Buscar últimas execuções
        rule_ids = [r.id for r in rules]
        executions = []
        if rule_ids:
            exec_result = await self.db.execute(
                select(AutomationExecution).where(
                    AutomationExecution.rule_id.in_(rule_ids)
                ).order_by(AutomationExecution.executed_at.desc()).limit(10)
            )
            executions_list = exec_result.scalars().all()

            # Mapear rule_id para nome
            rule_names = {r.id: r.name for r in rules}

            executions = [
                {
                    "automacao": rule_names.get(e.rule_id, "Automação"),
                    "data": e.executed_at.strftime("%d/%m/%Y %H:%M"),
                    "status": e.status,
                    "motivo": e.trigger_reason,
                    "resultado": e.result_data,
                    "erro": e.error_message
                }
                for e in executions_list
            ]

        # Contar por tipo
        tipos_gatilho = defaultdict(int)
        tipos_acao = defaultdict(int)
        for rule in rules:
            if rule.is_active:
                tipos_gatilho[rule.trigger_type] += 1
                tipos_acao[rule.action_type] += 1

        return {
            "automacoes_ativas": automacoes_ativas,
            "automacoes_inativas": automacoes_inativas,
            "automacoes_com_erro": automacoes_com_erro,
            "quantidade_ativas": len(automacoes_ativas),
            "quantidade_inativas": len(automacoes_inativas),
            "quantidade_com_erro": len(automacoes_com_erro),
            "total_automacoes": len(rules),
            "ultimas_execucoes": executions,
            "tipos_gatilho": dict(tipos_gatilho),
            "tipos_acao": dict(tipos_acao),
            "tem_automacoes": len(rules) > 0
        }

    # ========== PROMPTS ESPECIALIZADOS POR DOMÍNIO ==========

    def _get_expert_prompt(self, domains: list[str]) -> str:
        """Retorna instruções específicas para os especialistas dos domínios identificados"""

        prompts = {
            "cartoes": """## ESPECIALISTA EM CARTÕES DE CRÉDITO 💳

DADOS DISPONÍVEIS EM context["cartoes"]:
- cartoes: lista de cartões com limite, saldo_em_aberto, faturas, parcelas_vinculadas
- Para cada cartão: faturas (valor_total, valor_restante, vencimento, vencida)
- parcelas_vinculadas: parcelas ativas DESTE cartão específico
- impacto_mensal: fatura atual + parcelas (JÁ CALCULADO para você!)
- cartao_maior_impacto: cartão com maior impacto mensal
- cartoes_com_limite_apertado: cartões com >70% do limite usado

COMO RESPONDER PERGUNTAS DE CARTÃO:
1. "qual cartão tem maior impacto?" → Use cartao_maior_impacto, mostre impacto_mensal
2. "como estão meus cartões?" → Liste resumo de cada cartão com utilizacao_limite_percentual
3. "faturas vencidas?" → Procure faturas com vencida=true
4. "limite disponível?" → Mostre limite_disponivel de cada cartão

NUNCA confunda faturas_futuras (projeção GERAL) com faturas de cartão específico!""",

            "mercado": """## ESPECIALISTA EM MERCADO/COMPRAS 🛒

DADOS DISPONÍVEIS EM context["mercado"]:
- total_gasto_mercado: total gasto no período
- quantidade_compras: número de idas ao mercado
- media_por_compra: valor médio por compra
- gastos_por_categoria: ex: {"Carnes": 500, "Laticínios": 200}
- gastos_por_estabelecimento: onde mais gastou
- produtos_mais_comprados: produtos frequentes
- listas_de_compras_ativas: listas pendentes

COMO RESPONDER:
1. "quanto gastei no mercado?" → Use total_gasto_mercado e media_por_compra
2. "onde compro mais?" → Use gastos_por_estabelecimento
3. "quais produtos mais compro?" → Use produtos_mais_comprados
4. "tenho lista de compras?" → Use listas_de_compras_ativas""",

            "dividas": """## ESPECIALISTA EM DÍVIDAS 💰

DADOS DISPONÍVEIS EM context["dividas"]:
- dividas: lista com nome, saldo_atual, taxa_juros, pagamento_minimo
- total_dividas: soma de todas as dívidas
- juros_mensal_estimado: quanto paga de juros por mês
- estrategia_snowball: ordem para quitar menor saldo primeiro (motivação)
- estrategia_avalanche: ordem para quitar maior juros primeiro (economia)
- recomendacao: qual estratégia é melhor para o usuário

COMO RESPONDER:
1. "qual estratégia usar?" → Compare snowball vs avalanche, use recomendacao
2. "quanto pago de juros?" → Use juros_mensal_estimado
3. "quando quito minhas dívidas?" → Use meses_para_quitar_estimado
4. Sempre mencione economia potencial com avalanche se juros > 5%""",

            "orcamento": """## ESPECIALISTA EM ORÇAMENTO 📊

DADOS DISPONÍVEIS EM context["orcamento"]:
- score_saude: 0-100, quanto maior melhor
- total_planejado vs total_gasto: comparação
- percentual_usado: quanto do orçamento já foi gasto
- orcamento_diario_restante: quanto pode gastar por dia
- itens_orcamento: detalhes por categoria
- categorias_em_alerta: >80% usado
- categorias_estouradas: >100% usado

COMO RESPONDER:
1. "como está meu orçamento?" → Use score_saude e percentual_usado
2. "estourei alguma categoria?" → Use categorias_estouradas
3. "quanto posso gastar?" → Use orcamento_diario_restante
4. Alerte sobre categorias em alerta proativamente""",

            "metas": """## ESPECIALISTA EM METAS 🎯

DADOS DISPONÍVEIS EM context["metas"]:
- metas: lista com nome, valor_alvo, valor_atual, progresso_percentual
- contribuicao_mensal_necessaria: quanto precisa guardar por mês
- meses_restantes: tempo até o prazo
- progresso_geral: progresso consolidado de todas as metas

COMO RESPONDER:
1. "como estão minhas metas?" → Liste cada meta com progresso
2. "quanto preciso guardar?" → Use contribuicao_mensal_necessaria
3. "quando atinjo a meta?" → Use meses_restantes
4. Celebre progressos e encoraje contribuições""",

            "recorrentes": """## ESPECIALISTA EM ASSINATURAS/RECORRENTES 🔄

DADOS DISPONÍVEIS EM context["recorrentes"]:
- assinaturas: lista com nome, valor, frequencia, tipo_servico
- total_mensal: soma de todas as recorrentes
- total_anual_projetado: impacto anual
- gastos_por_tipo: streaming, música, etc.
- possivel_economia: estimativa de corte

COMO RESPONDER:
1. "quais assinaturas tenho?" → Liste assinaturas com valores
2. "quanto gasto com recorrentes?" → Use total_mensal
3. "o que posso cortar?" → Use possivel_economia e sugira streaming duplicado
4. Identifique serviços parecidos (streaming duplicado, etc.)""",

            "fluxo": """## ESPECIALISTA EM FLUXO DE CAIXA 📅

DADOS DISPONÍVEIS EM context["fluxo"]:
- saldo_atual: saldo total das contas
- contas: lista de contas com saldos
- proximas_receitas: quando e quanto vai receber
- receita_mensal_esperada: total esperado de receitas
- despesas_recorrentes_mes: compromissos fixos
- saldo_projetado_30_dias: previsão de saldo

COMO RESPONDER:
1. "quando recebo?" → Use proximas_receitas com dias_para_receber
2. "vou ter dinheiro?" → Compare saldo_atual com compromissos
3. "como está meu fluxo?" → Use fluxo_positivo e saldo_projetado
4. Alerte se saldo projetado ficar negativo""",

            "beneficios": """## ESPECIALISTA EM BENEFÍCIOS 🎫

DADOS DISPONÍVEIS EM context["beneficios"]:
- beneficios: lista com tipo, saldo_atual, recarga_esperada
- proxima_recarga: quando recarrega
- uso_diario_estimado: quanto está gastando por dia
- total_saldo_beneficios: saldo total de todos os benefícios

COMO RESPONDER:
1. "quanto tenho de VA/VR?" → Mostre saldo de cada benefício
2. "quando recarrega?" → Use proxima_recarga e dias_para_recarga
3. "está durando?" → Compare uso_diario_estimado com dias restantes
4. Alerte se saldo estiver acabando antes da recarga""",

            "envelopes": """## ESPECIALISTA EM ENVELOPES (Envelope Budgeting) 📦

DADOS DISPONÍVEIS EM context["envelopes"]:
- envelopes: lista com nome, limite, saldo_disponivel, percentual_usado
- valor_diario_disponivel: quanto pode gastar por dia em cada envelope
- valor_diario_total_disponivel: soma de todos os envelopes / dias restantes
- envelopes_estourados: envelopes que ultrapassaram o limite
- envelopes_em_alerta: envelopes com >80% usado
- total_disponivel: soma de todos os saldos disponíveis

COMO RESPONDER:
1. "quanto posso gastar hoje?" → Use valor_diario_total_disponivel
2. "como estão meus envelopes?" → Liste status de cada envelope
3. "estourei algum envelope?" → Use envelopes_estourados
4. Alerte sobre envelopes em alerta proativamente
5. Mostre valor diário disponível para ajudar no controle diário""",

            "calendario": """## ESPECIALISTA EM CALENDÁRIO FINANCEIRO 📆

DADOS DISPONÍVEIS EM context["calendario"]:
- todos_eventos_ordenados: próximos eventos financeiros por data
- faturas_proximas: faturas de cartão a vencer
- despesas_recorrentes_proximas: contas fixas a vencer
- receitas_esperadas: quando vai receber
- dividas_proximas: pagamentos de dívidas
- total_a_pagar_30_dias: total de compromissos
- total_a_receber_30_dias: total de receitas esperadas
- saldo_projetado: receitas - despesas dos próximos 30 dias

COMO RESPONDER:
1. "o que vence essa semana?" → Filtre todos_eventos_ordenados por dias <= 7
2. "quando pago a fatura?" → Use faturas_proximas
3. "quando recebo?" → Use receitas_esperadas
4. "vou conseguir pagar tudo?" → Compare total_a_pagar com saldo + receitas
5. Alerte se saldo_projetado for negativo""",

            "revisao": """## ESPECIALISTA EM REVIEW SEMANAL 📊

DADOS DISPONÍVEIS EM context["revisao"]:
- periodo_semana: período analisado
- receitas_semana, despesas_semana: totais da semana
- saldo_semana: receitas - despesas
- variacao_despesas_percentual: comparação com semana anterior
- transacoes_sem_categoria: lista de transações não categorizadas
- quantidade_sem_categoria: total de transações sem categoria
- top_categorias_semana: onde mais gastou
- dicas: insights gerados automaticamente

COMO RESPONDER:
1. "como foi minha semana?" → Use saldo_semana e variacao_despesas
2. "tenho transações sem categoria?" → Use transacoes_sem_categoria
3. "onde mais gastei?" → Use top_categorias_semana
4. Sempre mencione as dicas geradas
5. Se houver muitas transações sem categoria, incentive categorizar""",

            "automacoes": """## ESPECIALISTA EM AUTOMAÇÕES 🤖

DADOS DISPONÍVEIS EM context["automacoes"]:
- automacoes_ativas: regras funcionando
- automacoes_inativas: regras pausadas
- automacoes_com_erro: regras com falhas
- ultimas_execucoes: histórico recente
- tipos_gatilho: schedule, event, threshold
- tipos_acao: transfer, categorize, notify, tag, generate

COMO RESPONDER:
1. "quais automações tenho?" → Liste automacoes_ativas
2. "alguma automação com problema?" → Use automacoes_com_erro
3. "o que foi executado?" → Use ultimas_execucoes
4. Explique o que cada automação faz de forma simples
5. Se houver erros, sugira verificar a configuração""",

            "geral": """## ESPECIALISTA EM VISÃO GERAL 📋

DADOS DISPONÍVEIS EM context["geral"]:
- saldo_total: dinheiro disponível
- resumo_periodo: receitas, despesas, saldo
- comparacao_mes_anterior: variação de gastos
- saude_financeira: score e alertas
- total_dividas: se houver
- quantidade_metas, quantidade_cartoes: números gerais

COMO RESPONDER:
1. "como estão minhas finanças?" → Resumo com saldo, saúde, tendência
2. "me dá um resumo" → Principais números do mês
3. Sempre mencione se há alertas importantes (dívidas, cartões, orçamento)
4. Ofereça aprofundar em áreas específicas"""
        }

        # Combinar prompts dos domínios identificados
        combined_prompt = ""
        for domain in domains:
            if domain in prompts:
                combined_prompt += prompts[domain] + "\n\n"

        return combined_prompt

    async def _get_or_create_conversation(self, user: User, conversation_id: str | None) -> tuple[str, ChatConversation]:
        """Busca ou cria uma conversa no banco de dados"""
        if conversation_id:
            result = await self.db.execute(
                select(ChatConversation).where(
                    ChatConversation.id == conversation_id,
                    ChatConversation.user_id == user.id
                )
            )
            conversation = result.scalar_one_or_none()
            if conversation:
                return conversation_id, conversation

        # Criar nova conversa
        new_id = str(uuid.uuid4())
        conversation = ChatConversation(
            id=new_id,
            user_id=user.id
        )
        self.db.add(conversation)
        await self.db.flush()
        return new_id, conversation

    async def _get_conversation_history(self, conversation_id: str) -> list[dict]:
        """Busca as últimas mensagens da conversa do banco"""
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(MAX_MESSAGES_PER_CONVERSATION)
        )
        messages = result.scalars().all()
        # Reverter ordem (mais antigas primeiro)
        return [{"role": m.role.value, "content": m.content} for m in reversed(messages)]

    async def _save_message(self, conversation_id: str, role: str, content: str):
        """Salva mensagem e remove antigas se > limite"""
        # Criar mensagem
        message = ChatMessage(
            conversation_id=conversation_id,
            role=MessageRole(role),
            content=content
        )
        self.db.add(message)
        await self.db.flush()

        # Contar mensagens
        count_result = await self.db.execute(
            select(func.count(ChatMessage.id))
            .where(ChatMessage.conversation_id == conversation_id)
        )
        count = count_result.scalar()

        # Se > limite, deletar as mais antigas
        if count and count > MAX_MESSAGES_PER_CONVERSATION:
            excess = count - MAX_MESSAGES_PER_CONVERSATION
            oldest = await self.db.execute(
                select(ChatMessage.id)
                .where(ChatMessage.conversation_id == conversation_id)
                .order_by(ChatMessage.created_at.asc())
                .limit(excess)
            )
            old_ids = [row[0] for row in oldest.fetchall()]
            if old_ids:
                await self.db.execute(
                    delete(ChatMessage).where(ChatMessage.id.in_(old_ids))
                )

    async def chat(self, user: User, message: str, conversation_id: str | None = None) -> ChatResponse:
        """Processa mensagem do usuario e retorna resposta do agente usando arquitetura multi-agente"""

        # Buscar ou criar conversa no banco
        conversation_id, conversation = await self._get_or_create_conversation(user, conversation_id)

        # Buscar histórico do banco ANTES de classificar (para contexto)
        history = await self._get_conversation_history(conversation_id)

        # Analisar a pergunta para extrair periodo e filtros
        query_context = self._parse_query(message)

        # ========== ROUTER: Classificar domínios relevantes ==========
        # Passa o histórico para o classificador entender o contexto da conversa
        domains = await self._classify_intent_with_llm(message, history)

        # ========== BUSCAR CONTEXTO ESPECÍFICO DOS DOMÍNIOS ==========
        # Isso busca apenas os dados necessários, não todos os 20+ contextos
        context = await self._get_domain_context(user, domains, query_context)
        data_used = domains  # Mostra quais especialistas foram usados

        # ========== MONTAR PROMPT ESPECIALIZADO ==========
        system_prompt = self._build_expert_system_prompt(context, domains, message)

        # Adicionar mensagem do usuário ao histórico (em memória para chamar LLM)
        history.append({
            "role": "user",
            "content": message
        })

        # Chamar LLM
        response_text = await self._call_llm(system_prompt, history)

        # Salvar mensagens no banco (user e assistant)
        await self._save_message(conversation_id, "user", message)
        await self._save_message(conversation_id, "assistant", response_text)

        # Atualizar título da conversa se for a primeira mensagem
        if not conversation.title:
            conversation.title = message[:100] if len(message) <= 100 else message[:97] + "..."
            conversation.updated_at = datetime.utcnow()

        await self.db.commit()

        # Gerar sugestoes de follow-up (usar contexto geral para sugestões)
        full_context = await self._get_comprehensive_context(user, query_context) if "geral" not in domains else context.get("geral", {})
        suggestions = self._generate_smart_suggestions(message, full_context if isinstance(full_context, dict) else context)

        return ChatResponse(
            message=response_text,
            conversation_id=conversation_id,
            suggestions=suggestions,
            data_used=data_used
        )

    def _build_expert_system_prompt(self, context: dict, domains: list[str], user_message: str) -> str:
        """Constrói prompt do sistema com instruções especializadas para os domínios identificados"""
        context_json = json.dumps(context, cls=DecimalEncoder, ensure_ascii=False)

        # Obter instruções específicas dos especialistas
        expert_instructions = self._get_expert_prompt(domains)

        return f"""Você é o Fin, assistente financeiro pessoal ESPECIALIZADO.

DOMÍNIOS IDENTIFICADOS PARA ESTA PERGUNTA: {", ".join(domains)}

{expert_instructions}

REGRAS DE RESPOSTA (CRÍTICAS!):
1. Seja DIRETO e CONVERSACIONAL - como um amigo que entende de finanças
2. Respostas CURTAS: 2-4 frases para perguntas simples
3. Use números reais dos dados, mas NÃO liste tudo - destaque os principais
4. Ofereça aprofundar no final: "Quer que eu detalhe X?"
5. Só expanda se o usuário pedir explicitamente detalhes
6. Use os dados do contexto correto para cada domínio (context["cartoes"], context["mercado"], etc.)

DADOS DO USUÁRIO (APENAS DOS DOMÍNIOS RELEVANTES):
{context_json}

EXEMPLOS DE RESPOSTAS BOAS:

Para "qual cartão tem maior impacto mensal":
✅ "O {{nome_cartao}} tem o maior impacto com R$ {{impacto_mensal}}/mês (fatura R$ X + parcelas R$ Y). Ele está com {{utilizacao}}% do limite usado. Quer ver estratégia de pagamento?"

Para "quanto gastei no mercado":
✅ "Você gastou R$ {{total}} no mercado este mês, em {{quantidade}} compras (média de R$ {{media}}/compra). O maior gasto foi em {{categoria}}. Quer ver os produtos mais comprados?"

Para "como estão minhas finanças":
✅ "Seu saldo é R$ {{saldo}}. Este mês: receitas R$ {{receitas}}, despesas R$ {{despesas}} ({{variacao}}% vs mês passado). Score de saúde: {{score}}/100. Quer ver alguma área específica?"

PONTOS IMPORTANTES:
- Use APENAS os dados disponíveis no contexto fornecido
- Se um dado não estiver disponível, diga que precisa de mais informações
- Sempre ofereça uma próxima ação ou pergunta de follow-up
- Use emojis com moderação (máximo 1-2 por resposta)"""

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

        # 14. Parcelas ativas (InstallmentSeries)
        context["parcelas_ativas"] = await self._get_installment_series(user)

        # 15. Despesas recorrentes (assinaturas)
        context["recorrentes"] = await self._get_recurring_transactions(user)

        # 16. Projecao de faturas futuras
        context["faturas_futuras"] = await self._get_future_invoices(user, context)

        # 17. Cartoes de beneficio (VA/VR/VT)
        context["beneficios"] = await self._get_benefit_cards(user)

        # 18. Health score do orcamento
        context["saude_financeira"] = await self._get_budget_health(user)

        # 19. Estrategia de dividas (se houver dividas)
        if context.get("dividas"):
            context["estrategia_dividas"] = await self._get_debt_strategy(user)

        return context

    async def _get_installment_series(self, user: User) -> list[dict]:
        """Busca parcelas ativas com projecao"""
        result = await self.db.execute(
            select(InstallmentSeries).where(
                InstallmentSeries.user_id == user.id,
                InstallmentSeries.status == InstallmentSeriesStatus.ACTIVE.value
            ).order_by(InstallmentSeries.installment_amount.desc())
        )
        series_list = result.scalars().all()

        parcelas = []
        today = date.today()
        for s in series_list:
            # Calcular data de termino estimada
            remaining = s.installment_count - s.paid_count
            end_date = today + relativedelta(months=remaining)

            parcelas.append({
                "descricao": s.description,
                "estabelecimento": s.merchant_name,
                "valor_parcela": float(s.installment_amount),
                "valor_total": float(s.total_amount),
                "parcelas_totais": s.installment_count,
                "parcelas_pagas": s.paid_count,
                "parcelas_restantes": remaining,
                "valor_restante": float(s.installment_amount * remaining),
                "termino_previsto": end_date.strftime("%m/%Y")
            })

        return parcelas

    async def _get_recurring_transactions(self, user: User) -> list[dict]:
        """Busca despesas recorrentes/assinaturas ativas"""
        result = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user.id,
                RecurringTransaction.status == RecurringStatus.ACTIVE.value,
                RecurringTransaction.type == "expense"
            ).order_by(RecurringTransaction.amount.desc())
        )
        recurring_list = result.scalars().all()

        # Buscar categorias
        category_ids = [r.category_id for r in recurring_list if r.category_id]
        categories: dict[int | None, str] = {}
        if category_ids:
            cat_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories = {c.id: c.name for c in cat_result.scalars().all()}

        recorrentes = []
        for r in recurring_list:
            freq_display = {
                "daily": "diario",
                "weekly": "semanal",
                "monthly": "mensal",
                "yearly": "anual"
            }.get(r.frequency, r.frequency)

            recorrentes.append({
                "nome": r.name,
                "valor": float(r.amount),
                "frequencia": freq_display,
                "categoria": categories.get(r.category_id, "Sem categoria"),
                "proximo_vencimento": r.next_due_date.strftime("%d/%m/%Y") if r.next_due_date else None,
                "dia_do_mes": r.day_of_month
            })

        return recorrentes

    async def _get_future_invoices(self, user: User, context: dict) -> list[dict]:
        """Projeta faturas dos proximos 3 meses baseado em parcelas e recorrentes"""
        today = date.today()
        projecao = []

        # Soma de parcelas ativas por mes
        parcelas = context.get("parcelas_ativas", [])
        total_parcelas_mes = sum(p.get("valor_parcela", 0) for p in parcelas)

        # Soma de recorrentes mensais
        recorrentes = context.get("recorrentes", [])
        total_recorrentes_mes = sum(
            r.get("valor", 0) for r in recorrentes
            if r.get("frequencia") == "mensal"
        )

        for i in range(1, 4):
            mes_futuro = today + relativedelta(months=i)

            # Contar quantas parcelas ainda estarao ativas nesse mes
            parcelas_ativas_mes = 0
            for p in parcelas:
                if p.get("parcelas_restantes", 0) > i:
                    parcelas_ativas_mes += p.get("valor_parcela", 0)

            projecao.append({
                "mes": mes_futuro.strftime("%B/%Y"),
                "mes_numero": mes_futuro.month,
                "ano": mes_futuro.year,
                "parcelas_previstas": parcelas_ativas_mes,
                "recorrentes_previstas": total_recorrentes_mes,
                "total_projetado": parcelas_ativas_mes + total_recorrentes_mes
            })

        return projecao

    async def _get_benefit_cards(self, user: User) -> list[dict]:
        """Busca cartoes de beneficio VA/VR/VT"""
        result = await self.db.execute(
            select(BenefitCard).where(
                BenefitCard.user_id == user.id,
                BenefitCard.is_active == True
            )
        )
        benefit_cards = result.scalars().all()

        # Buscar contas vinculadas para obter saldos
        account_ids = [b.account_id for b in benefit_cards]
        accounts: dict[int, Account] = {}
        if account_ids:
            acc_result = await self.db.execute(
                select(Account).where(Account.id.in_(account_ids))
            )
            accounts = {a.id: a for a in acc_result.scalars().all()}

        beneficios = []
        for b in benefit_cards:
            account = accounts.get(b.account_id)
            beneficios.append({
                "tipo": b.card_type_display,
                "operadora": b.provider_display,
                "ultimos_digitos": b.last_four_digits,
                "saldo_atual": float(account.balance) if account else 0,
                "recarga_esperada": float(b.expected_monthly_recharge) if b.expected_monthly_recharge else None,
                "dia_recarga": b.recharge_day
            })

        return beneficios

    async def _get_budget_health(self, user: User) -> dict:
        """Calcula health score do orcamento do mes atual"""
        today = date.today()

        # Buscar orcamento do mes
        budget_result = await self.db.execute(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.year == today.year,
                Budget.month == today.month
            )
        )
        budget = budget_result.scalar_one_or_none()

        if not budget:
            return {
                "tem_orcamento": False,
                "score": None,
                "mensagem": "Sem orcamento definido para este mes"
            }

        # Buscar itens do orcamento
        items_result = await self.db.execute(
            select(BudgetItem).where(BudgetItem.budget_id == budget.id)
        )
        budget_items = items_result.scalars().all()

        # Buscar categorias
        category_ids = [b.category_id for b in budget_items if b.category_id]
        categories: dict[int | None, str] = {}
        if category_ids:
            cat_result = await self.db.execute(
                select(Category).where(Category.id.in_(category_ids))
            )
            categories = {c.id: c.name for c in cat_result.scalars().all()}

        # Buscar gastos reais do mes
        start_date = date(today.year, today.month, 1)
        result = await self.db.execute(
            select(
                Transaction.category_id,
                func.sum(Transaction.amount).label('total')
            ).where(
                Transaction.user_id == user.id,
                Transaction.type == TransactionType.EXPENSE.value,
                Transaction.date >= start_date,
                Transaction.date <= today
            ).group_by(Transaction.category_id)
        )
        gastos_por_categoria = {row.category_id: float(row.total) for row in result.all()}

        # Calcular categorias em alerta (>80% do orcamento)
        categorias_alerta = []
        total_planejado = 0
        total_gasto = 0

        for item in budget_items:
            planejado = float(item.planned_amount)
            gasto = gastos_por_categoria.get(item.category_id, 0)
            total_planejado += planejado
            total_gasto += gasto

            if planejado > 0:
                percentual = (gasto / planejado) * 100
                if percentual >= 80:
                    cat_name = categories.get(item.category_id, "Categoria")
                    categorias_alerta.append({
                        "categoria": cat_name,
                        "planejado": planejado,
                        "gasto": gasto,
                        "percentual": round(percentual, 1)
                    })

        # Calcular score (0-100)
        score = 100.0
        if total_planejado > 0:
            percentual_total = (total_gasto / total_planejado) * 100
            if percentual_total > 100:
                score = max(0, 100 - (percentual_total - 100) * 2)
            elif percentual_total > 80:
                score = 100 - (percentual_total - 80)

        return {
            "tem_orcamento": True,
            "score": round(score, 1),
            "total_planejado": total_planejado,
            "total_gasto": total_gasto,
            "percentual_usado": round((total_gasto / total_planejado * 100), 1) if total_planejado > 0 else 0,
            "categorias_alerta": categorias_alerta[:5]  # Top 5 em alerta
        }

    async def _get_debt_strategy(self, user: User) -> dict:
        """Calcula estrategia de quitacao de dividas (snowball vs avalanche)"""
        result = await self.db.execute(
            select(Debt).where(
                Debt.user_id == user.id,
                Debt.status == DebtStatus.ACTIVE.value
            ).order_by(Debt.current_balance.asc())
        )
        debts = result.scalars().all()

        if not debts:
            return {"tem_dividas": False}

        # Calcular totais
        total_dividas = sum(float(d.current_balance) for d in debts)
        total_minimo = sum(float(d.minimum_payment) for d in debts)
        total_juros_mensal = sum(
            float(d.current_balance) * (float(d.interest_rate) / 100)
            for d in debts
            if d.interest_type == "monthly"
        )

        # Identificar divida de menor saldo (snowball)
        menor_saldo = min(debts, key=lambda d: d.current_balance)

        # Identificar divida de maior juros (avalanche)
        maior_juros = max(debts, key=lambda d: d.interest_rate)

        # Estimar meses para quitar (simplificado)
        meses_estimados = int(total_dividas / total_minimo) + 1 if total_minimo > 0 else 0

        return {
            "tem_dividas": True,
            "total_dividas": total_dividas,
            "total_pagamento_minimo": total_minimo,
            "juros_mensal_estimado": round(total_juros_mensal, 2),
            "quantidade_dividas": len(debts),
            "estrategia_snowball": {
                "primeira_divida": menor_saldo.name,
                "saldo": float(menor_saldo.current_balance),
                "descricao": "Quitar a menor divida primeiro para ganhar motivacao"
            },
            "estrategia_avalanche": {
                "primeira_divida": maior_juros.name,
                "taxa_juros": float(maior_juros.interest_rate),
                "descricao": "Quitar a de maior juros primeiro para economizar dinheiro"
            },
            "meses_para_quitar": meses_estimados,
            "recomendacao": "avalanche" if float(maior_juros.interest_rate) > 5 else "snowball"
        }

    def _build_enhanced_system_prompt(self, context: dict, user_message: str) -> str:
        """Constroi prompt do sistema otimizado para respostas concisas e conversacionais"""
        context_json = json.dumps(context, cls=DecimalEncoder, ensure_ascii=False)

        return f"""Voce e o Fin, assistente financeiro pessoal.

REGRAS DE RESPOSTA (CRITICAS!):
1. Seja DIRETO e CONVERSACIONAL - como um amigo que entende de financas
2. Respostas CURTAS: 2-4 frases para perguntas simples
3. Use numeros reais dos dados, mas NAO liste tudo - destaque os principais
4. Ofereca aprofundar no final: "Quer que eu detalhe X?"
5. So expanda se o usuario pedir explicitamente detalhes

DADOS DO USUARIO:
{context_json}

COMO USAR CADA DADO (MUITO IMPORTANTE!):
- cartoes_credito: Para perguntas sobre cartoes, use "saldo_em_aberto" e "faturas" de cada cartao. O impacto mensal de um cartao e o valor_total das faturas abertas/fechadas.
- parcelas_ativas: Para perguntas sobre parcelas/parcelamentos, use valor_parcela e parcelas_restantes.
- recorrentes: Para assinaturas e despesas fixas mensais.
- faturas_futuras: Projecao GERAL (soma de todas parcelas + recorrentes), NAO use para perguntas especificas de cartao.
- gastos_por_categoria: Para perguntas sobre gastos por tipo.
- gastos_por_estabelecimento: Para perguntas sobre onde mais gasta.

EXEMPLOS DE RESPOSTAS:

Para "quanto gastei esse mes":
❌ Ruim: [lista de 10 categorias com percentuais, analises e sugestoes]
✅ Bom: "Voce gastou R$ 25.273 em janeiro. Os maiores: Fatura (R$ 17k), Outros (R$ 4.3k), Mercado (R$ 1.5k). Quer ver alguma categoria em detalhe?"

Para "qual cartao tem maior impacto":
❌ Ruim: Usar faturas_futuras (que e projecao geral)
✅ Bom: Olhar cartoes_credito, comparar saldo_em_aberto de cada um. Ex: "O Carrefour tem R$ 9.400 em aberto, o maior entre seus cartoes. Quer ver estrategia de pagamento?"

Para "como estao meus cartoes":
✅ Bom: "Seus cartoes tem R$ 24.500 em aberto. O Carrefour esta com 85% do limite usado - atencao! Quer ver estrategia de pagamento?"

Para "tenho parcelas":
✅ Bom: "Suas parcelas somam R$ 3.200/mes pelos proximos 8 meses. A maior e a TV em 10x de R$ 450. Quer ver a projecao completa?"

Para "assinaturas":
✅ Bom: "Encontrei 4 recorrentes (R$ 340/mes): Netflix R$ 55, Spotify R$ 34, iCloud R$ 21, Academia R$ 150. Quer que eu analise quais cortar?"

PONTOS IMPORTANTES:
- SEMPRE verifique qual dado e correto para a pergunta antes de responder
- Se o usuario pedir "detalhe", "explique", "analise", ai sim responda de forma mais completa
- Use emojis com moderacao (maximo 1-2 por resposta)
- Sempre ofereça uma proxima acao ou pergunta de follow-up
- Nao repita dados que o usuario ja viu na mesma conversa"""

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
                        "maxOutputTokens": 600,
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
                    "max_tokens": 600,
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
