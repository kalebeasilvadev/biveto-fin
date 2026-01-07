"""
Agente IA Financeiro - Assistente Inteligente de Finanças Pessoais
Suporta múltiplos providers: Google Gemini (gratuito), OpenAI, Anthropic
"""
from __future__ import annotations
import json
import httpx
import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..core.config import settings
from ..models.user import User
from ..models.transaction import Transaction, TransactionType
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

    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = settings.vision_provider
        self.conversations: dict[str, list[dict]] = {}  # Em memória por enquanto

    async def chat(self, user: User, message: str, conversation_id: str | None = None) -> ChatResponse:
        """Processa mensagem do usuário e retorna resposta do agente"""

        # Criar ou recuperar conversa
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            self.conversations[conversation_id] = []

        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []

        # Buscar contexto financeiro do usuário
        context = await self._get_user_financial_context(user)
        data_used = list(context.keys())

        # Montar prompt do sistema
        system_prompt = self._build_system_prompt(context)

        # Adicionar mensagem do usuário ao histórico
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
        suggestions = self._generate_suggestions(message, context)

        return ChatResponse(
            message=response_text,
            conversation_id=conversation_id,
            suggestions=suggestions,
            data_used=data_used
        )

    async def _get_user_financial_context(self, user: User) -> dict:
        """Busca todos os dados financeiros relevantes do usuário"""
        context = {}
        today = date.today()
        month_start = date(today.year, today.month, 1)

        # Get household member IDs if user is part of a household
        household_user_ids = await self._get_household_user_ids(user)

        # 1. Resumo de contas (pessoais + household)
        if household_user_ids:
            from sqlalchemy import or_, and_
            accounts = await self.db.execute(
                select(Account).where(
                    or_(
                        and_(
                            Account.user_id == user.id,
                            Account.ownership_type == "personal"
                        ),
                        and_(
                            Account.user_id.in_(household_user_ids),
                            Account.ownership_type == "household"
                        )
                    )
                )
            )
        else:
            accounts = await self.db.execute(
                select(Account).where(Account.user_id == user.id)
            )
        accounts_list = accounts.scalars().all()
        context["contas"] = [
            {"nome": a.name, "tipo": a.type, "saldo": float(a.balance)}
            for a in accounts_list
        ]
        context["saldo_total"] = sum(float(a.balance) for a in accounts_list)

        # 2. Transações do mês atual (pessoais + household)
        if household_user_ids:
            from sqlalchemy import or_, and_
            transactions = await self.db.execute(
                select(Transaction).where(
                    Transaction.date >= month_start,
                    or_(
                        and_(
                            Transaction.user_id == user.id,
                            Transaction.ownership_type == "personal"
                        ),
                        and_(
                            Transaction.user_id.in_(household_user_ids),
                            Transaction.ownership_type == "household"
                        )
                    )
                )
            )
        else:
            transactions = await self.db.execute(
                select(Transaction).where(
                    Transaction.user_id == user.id,
                    Transaction.date >= month_start
                )
            )
        txs = transactions.scalars().all()

        receitas = sum(float(t.amount) for t in txs if t.type == TransactionType.INCOME)
        despesas = sum(float(t.amount) for t in txs if t.type == TransactionType.EXPENSE)

        context["mes_atual"] = {
            "receitas": receitas,
            "despesas": despesas,
            "saldo": receitas - despesas,
            "total_transacoes": len(txs)
        }

        # 3. Dívidas ativas
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

        # 4. Metas financeiras
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
                "progresso": float(g.current_amount / g.target_amount * 100) if g.target_amount > 0 else 0,
                "prazo": g.target_date.isoformat() if g.target_date else None
            }
            for g in goals_list
        ]

        # 5. Orçamento do mês (buscar através de Budget)
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
            context["orcamento"] = [
                {
                    "categoria_id": b.category_id,
                    "planejado": float(b.planned_amount),
                }
                for b in budget_items
            ]
        else:
            context["orcamento"] = []

        return context

    def _build_system_prompt(self, context: dict) -> str:
        """Constrói o prompt do sistema com contexto financeiro"""
        context_json = json.dumps(context, cls=DecimalEncoder, ensure_ascii=False, indent=2)

        return f"""Você é um consultor financeiro pessoal inteligente e empático chamado "Fin".
Você ajuda brasileiros a organizarem suas finanças de forma prática e acessível.

DADOS FINANCEIROS DO USUÁRIO:
{context_json}

SUAS RESPONSABILIDADES:
1. Analisar a situação financeira do usuário com base nos dados acima
2. Dar recomendações práticas e específicas (não genéricas)
3. Usar metodologias consagradas: Dave Ramsey, Gustavo Cerbasi, Método 50-30-20
4. Explicar cálculos de forma simples
5. Motivar e encorajar sem ser condescendente

REGRAS IMPORTANTES:
- Sempre mencione valores reais dos dados quando relevante
- Se não tiver dados suficientes, sugira que o usuário cadastre mais informações
- Use português brasileiro informal mas profissional
- Formate valores como R$ X.XXX,XX
- Para dívidas, sempre considere estratégias Snowball e Avalanche
- Seja direto e prático, evite respostas muito longas
- Use emojis com moderação para tornar a conversa mais amigável

FORMATO DE RESPOSTA:
- Parágrafos curtos e objetivos
- Use bullet points quando listar recomendações
- Destaque números importantes
- Termine com uma pergunta ou sugestão de ação quando apropriado"""

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
                return "Desculpe, nenhum provider de IA está configurado. Configure GOOGLE_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY no arquivo .env"
        except Exception as e:
            return f"Desculpe, ocorreu um erro ao processar sua mensagem: {str(e)}"

    async def _call_google(self, system_prompt: str, messages: list[dict]) -> str:
        """Chama Google Gemini API"""
        api_key = settings.google_api_key
        if not api_key:
            return "Configure GOOGLE_API_KEY no arquivo .env para usar o assistente. Obtenha gratuitamente em: https://aistudio.google.com/apikey"

        # Converter mensagens para formato Gemini
        contents = []

        # Adicionar system prompt como primeira mensagem do usuário
        contents.append({
            "role": "user",
            "parts": [{"text": system_prompt}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": "Entendido! Sou o Fin, seu consultor financeiro pessoal. Estou pronto para ajudar com base nos seus dados financeiros. Como posso ajudar?"}]
        })

        # Adicionar histórico de mensagens
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
                        "temperature": 0.7,
                        "maxOutputTokens": 1500,
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

        # Converter mensagens para formato OpenAI
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
                    "max_tokens": 1500,
                    "temperature": 0.7,
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

        # Converter mensagens para formato Anthropic
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
                    "max_tokens": 1500,
                    "system": system_prompt,
                    "messages": anthropic_messages,
                },
            )

            if response.status_code != 200:
                return f"Erro na API da Anthropic: {response.status_code}"

            result = response.json()
            return result["content"][0]["text"]

    def _generate_suggestions(self, message: str, context: dict) -> list[str]:
        """Gera sugestões de perguntas de follow-up baseadas no contexto"""
        suggestions = []

        # Sugestões baseadas nos dados disponíveis
        if context.get("dividas"):
            suggestions.append("Qual a melhor estratégia para quitar minhas dívidas?")

        if context.get("metas"):
            suggestions.append("Como posso acelerar minhas metas financeiras?")

        if context.get("mes_atual", {}).get("despesas", 0) > context.get("mes_atual", {}).get("receitas", 0):
            suggestions.append("Como posso reduzir meus gastos este mês?")

        if not context.get("orcamento"):
            suggestions.append("Me ajude a criar um orçamento mensal")

        # Sugestões gerais
        general_suggestions = [
            "Analise minha saúde financeira",
            "Quanto devo guardar por mês?",
            "Como montar uma reserva de emergência?",
        ]

        # Combinar e limitar a 3 sugestões
        all_suggestions = suggestions + general_suggestions
        return all_suggestions[:3]

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
