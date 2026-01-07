"""
Agente IA Financeiro - Assistente Inteligente de Finanças Pessoais
Suporta múltiplos providers: Google Gemini (gratuito), OpenAI, Anthropic
Com análise detalhada de gastos por categoria, estabelecimento e período.
"""
from __future__ import annotations
import json
import httpx
import uuid
import re
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from collections import defaultdict

from ..core.config import settings
from ..models.user import User
from ..models.transaction import Transaction, TransactionType
from ..models.category import Category
from ..models.merchant import Merchant
from ..models.debt import Debt, DebtStatus
from ..models.goal import Goal
from ..models.budget import Budget, BudgetItem
from ..models.account import Account
from ..models.household import HouseholdMember
from ..schemas.chat import ChatResponse


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)


class FinancialAgentService:
    """Agente IA para recomendações financeiras personalizadas"""

    # Mapeamento de meses em português
    MONTHS_PT = {
        "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
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
        """Processa mensagem do usuário e retorna resposta do agente"""

        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            self.conversations[conversation_id] = []

        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []

        # Analisar a pergunta para extrair período e filtros
        query_context = self._parse_query(message)

        # Buscar contexto financeiro completo
        context = await self._get_comprehensive_context(user, query_context)
        data_used = list(context.keys())

        # Montar prompt do sistema
        system_prompt = self._build_enhanced_system_prompt(context, message)

        # Adicionar mensagem ao histórico
        self.conversations[conversation_id].append({
            "role": "user",
            "content": message
        })

        # Chamar LLM
        response_text = await self._call_llm(system_prompt, self.conversations[conversation_id])

        # Adicionar resposta ao histórico
        self.conversations[conversation_id].append({
            "role": "assistant",
            "content": response_text
        })

        # Gerar sugestões de follow-up
        suggestions = self._generate_smart_suggestions(message, context)

        return ChatResponse(
            message=response_text,
            conversation_id=conversation_id,
            suggestions=suggestions,
            data_used=data_used
        )

    def _parse_query(self, message: str) -> dict:
        """Analisa a mensagem para extrair período, categorias e filtros"""
        message_lower = message.lower()
        query = {
            "period": None,
            "category_keywords": [],
            "merchant_keywords": [],
            "comparison": False,
        }

        today = date.today()

        # Detectar mês específico
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

        # Detectar períodos relativos
        if not query["period"]:
            if "esse mês" in message_lower or "este mês" in message_lower or "mês atual" in message_lower:
                query["period"] = {
                    "start": date(today.year, today.month, 1),
                    "end": today,
                    "label": "Mês atual"
                }
            elif "mês passado" in message_lower or "último mês" in message_lower:
                last_month = today - relativedelta(months=1)
                query["period"] = {
                    "start": date(last_month.year, last_month.month, 1),
                    "end": (date(last_month.year, last_month.month, 1) + relativedelta(months=1)) - timedelta(days=1),
                    "label": "Mês passado"
                }
            elif "últimos 3 meses" in message_lower or "ultimos 3 meses" in message_lower:
                start = today - relativedelta(months=3)
                query["period"] = {
                    "start": date(start.year, start.month, 1),
                    "end": today,
                    "label": "Últimos 3 meses"
                }
            elif "esse ano" in message_lower or "este ano" in message_lower or "ano atual" in message_lower:
                query["period"] = {
                    "start": date(today.year, 1, 1),
                    "end": today,
                    "label": f"Ano {today.year}"
                }

        # Se não detectou período, usar mês atual como padrão
        if not query["period"]:
            query["period"] = {
                "start": date(today.year, today.month, 1),
                "end": today,
                "label": "Mês atual"
            }

        # Detectar categorias mencionadas
        category_keywords = [
            "alimentação", "comida", "restaurante", "mercado", "supermercado",
            "transporte", "uber", "gasolina", "combustível",
            "lazer", "entretenimento", "netflix", "streaming",
            "saúde", "farmácia", "médico", "hospital",
            "educação", "escola", "curso", "faculdade",
            "moradia", "aluguel", "condomínio", "luz", "água", "gás",
            "roupas", "vestuário", "shopping",
            "carne", "açougue", "proteína",
            "ifood", "delivery", "rappi",
            "assinatura", "spotify", "amazon"
        ]

        for keyword in category_keywords:
            if keyword in message_lower:
                query["category_keywords"].append(keyword)

        # Detectar comparação
        if "comparar" in message_lower or "versus" in message_lower or "vs" in message_lower:
            query["comparison"] = True

        return query

    async def _get_comprehensive_context(self, user: User, query_context: dict) -> dict:
        """Busca contexto financeiro completo e detalhado"""
        context = {}
        today = date.today()
        period = query_context.get("period", {})
        period_start = period.get("start", date(today.year, today.month, 1))
        period_end = period.get("end", today)
        period_label = period.get("label", "Período selecionado")

        household_user_ids = await self._get_household_user_ids(user)

        # 1. Buscar todas as categorias
        categories_result = await self.db.execute(
            select(Category).where(
                or_(Category.user_id == user.id, Category.is_system == True)
            )
        )
        categories = {c.id: c.name for c in categories_result.scalars().all()}
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

        # 3. Transações do período selecionado com detalhes completos
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
        merchants = {}
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
        gastos_por_categoria = defaultdict(lambda: {"total": 0, "count": 0, "transacoes": []})
        for t in txs:
            if t.type == TransactionType.EXPENSE.value:
                cat_name = categories.get(t.category_id, "Sem categoria")
                merchant_name = merchants.get(t.merchant_id, t.description or "Não identificado")
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
        gastos_por_estabelecimento = defaultdict(lambda: {"total": 0, "count": 0, "categoria": None})
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
        receitas_por_categoria = defaultdict(lambda: {"total": 0, "count": 0})
        for t in txs:
            if t.type == TransactionType.INCOME.value:
                cat_name = categories.get(t.category_id, "Sem categoria")
                receitas_por_categoria[cat_name]["total"] += float(t.amount)
                receitas_por_categoria[cat_name]["count"] += 1

        context["receitas_por_categoria"] = dict(receitas_por_categoria)

        # 7. Top 10 maiores gastos do período
        despesas_list = [t for t in txs if t.type == TransactionType.EXPENSE.value]
        despesas_list.sort(key=lambda x: float(x.amount), reverse=True)
        context["maiores_gastos"] = [
            {
                "valor": float(t.amount),
                "data": t.date.strftime("%d/%m/%Y"),
                "estabelecimento": merchants.get(t.merchant_id, t.description or "Não identificado"),
                "categoria": categories.get(t.category_id, "Sem categoria")
            }
            for t in despesas_list[:10]
        ]

        # 8. Dívidas ativas
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

        # 10. Orçamento do mês
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

        # 11. Comparação com mês anterior (se relevante)
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

        return context

    def _build_enhanced_system_prompt(self, context: dict, user_message: str) -> str:
        """Constrói prompt do sistema otimizado para respostas precisas"""
        context_json = json.dumps(context, cls=DecimalEncoder, ensure_ascii=False, indent=2)

        return f"""Você é o Fin, um consultor financeiro pessoal inteligente e preciso.
Você TEM ACESSO COMPLETO aos dados financeiros do usuário e DEVE usá-los para responder.

DADOS FINANCEIROS REAIS DO USUÁRIO (USE ESTES DADOS!):
{context_json}

PERGUNTA DO USUÁRIO: "{user_message}"

INSTRUÇÕES CRÍTICAS:
1. SEMPRE use os dados acima para responder - você TEM os dados!
2. Se perguntarem sobre gastos específicos (ex: "quanto gastei com carne"), procure em:
   - gastos_por_categoria: gastos agrupados por categoria
   - gastos_por_estabelecimento: gastos por loja/estabelecimento
   - maiores_gastos: lista detalhada das maiores despesas
3. Cite valores EXATOS dos dados quando disponíveis
4. Se não encontrar dados específicos, explique quais dados você encontrou e sugira como rastrear melhor

FORMATO DE RESPOSTA:
- Use português brasileiro, informal mas profissional
- Formate valores como R$ X.XXX,XX
- Seja direto e preciso
- Use bullet points para listas
- Destaque insights importantes
- Não invente dados - use apenas o que está no contexto

EXEMPLOS DE COMO RESPONDER:
- "Segundo seus dados, você gastou R$ X com [categoria] este mês"
- "Analisando suas transações, identifiquei R$ X em [estabelecimento]"
- "Comparando com o mês anterior, seus gastos com [categoria] aumentaram X%"

Se a categoria ou estabelecimento específico não existir nos dados, responda:
"Não encontrei gastos específicos com [termo], mas identifiquei gastos em categorias relacionadas como [listar]. Quer que eu detalhe alguma delas?"

Termine com uma pergunta ou sugestão de ação quando apropriado."""

    async def _call_llm(self, system_prompt: str, messages: list[dict]) -> str:
        """Chama o LLM configurado"""
        try:
            if self.provider == "google":
                return await self._call_google(system_prompt, messages)
            elif self.provider == "openai":
                return await self._call_openai(system_prompt, messages)
            elif self.provider == "anthropic":
                return await self._call_anthropic(system_prompt, messages)
            else:
                return "Desculpe, nenhum provider de IA está configurado. Configure GOOGLE_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY."
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

    async def _call_openai(self, system_prompt: str, messages: list[dict]) -> str:
        """Chama OpenAI API"""
        api_key = settings.openai_api_key
        if not api_key:
            return "Configure OPENAI_API_KEY no arquivo .env para usar o assistente."

        openai_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            openai_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": openai_messages,
                    "max_tokens": 2000,
                    "temperature": 0.4,
                },
            )

            if response.status_code != 200:
                return f"Erro na API da OpenAI: {response.status_code}"

            result = response.json()
            return result["choices"][0]["message"]["content"]

    async def _call_anthropic(self, system_prompt: str, messages: list[dict]) -> str:
        """Chama Anthropic Claude API"""
        api_key = settings.anthropic_api_key
        if not api_key:
            return "Configure ANTHROPIC_API_KEY no arquivo .env para usar o assistente."

        anthropic_messages = []
        for msg in messages:
            anthropic_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 2000,
                    "system": system_prompt,
                    "messages": anthropic_messages,
                },
            )

            if response.status_code != 200:
                return f"Erro na API da Anthropic: {response.status_code}"

            result = response.json()
            return result["content"][0]["text"]

    def _generate_smart_suggestions(self, message: str, context: dict) -> list[str]:
        """Gera sugestões inteligentes baseadas no contexto"""
        suggestions = []
        message_lower = message.lower()

        # Se falou de gastos, sugerir detalhamento
        if "gast" in message_lower:
            if context.get("gastos_por_categoria"):
                top_cat = list(context["gastos_por_categoria"].keys())[0] if context["gastos_por_categoria"] else None
                if top_cat:
                    suggestions.append(f"Detalhe meus gastos com {top_cat}")

        # Se tem dívidas, sugerir estratégia
        if context.get("dividas") and "dívid" not in message_lower:
            suggestions.append("Qual estratégia para quitar minhas dívidas?")

        # Se tem metas, sugerir acompanhamento
        if context.get("metas") and "meta" not in message_lower:
            suggestions.append("Como estão minhas metas?")

        # Se falou de mês específico, sugerir comparação
        if any(m in message_lower for m in self.MONTHS_PT.keys()):
            suggestions.append("Compare com o mês anterior")

        # Sugestões gerais baseadas nos dados
        resumo = context.get("resumo_periodo", {})
        if resumo.get("despesas", 0) > resumo.get("receitas", 0):
            suggestions.append("Como equilibrar minhas finanças?")

        comparacao = context.get("comparacao_mes_anterior", {})
        if comparacao.get("variacao_despesas", 0) > 10:
            suggestions.append("Por que meus gastos aumentaram?")

        # Sugestões padrão
        default_suggestions = [
            "Analise minha saúde financeira",
            "Quanto devo guardar por mês?",
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
