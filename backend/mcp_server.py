#!/usr/bin/env python3
"""
MCP Server para App Financeiro
Permite cadastrar e consultar lançamentos financeiros via assistentes de IA
"""

import asyncio
import json
from datetime import date, datetime
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Importar modelos e configurações
import sys
import os

# Adicionar o diretório app ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.transaction import Transaction, TransactionType
from app.models.account import Account
from app.models.category import Category
from app.models.merchant import Merchant
from app.models.user import User
from app.models.installment import InstallmentSeries, InstallmentSeriesStatus
from app.models.budget import Budget, BudgetItem
from app.models.goal import Goal, GoalContribution, GoalStatus, GoalType
from app.models.debt import Debt, DebtPayment, DebtStatus
from app.core.database import Base
from app.core.config import settings
from app.services.installment_service import InstallmentService
from app.services.budget_service import BudgetService
from app.services.goal_service import GoalService
from app.services.debt_service import DebtService


# Criar engine e session
engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Criar servidor MCP
server = Server("app-financeiro")


async def get_default_user(session: AsyncSession) -> User | None:
    """Obtém o primeiro usuário ativo (para uso simplificado)"""
    result = await session.execute(
        select(User).where(User.is_active == True).limit(1)
    )
    return result.scalar_one_or_none()


async def get_or_create_merchant(session: AsyncSession, name: str) -> int:
    """Obtém ou cria um merchant pelo nome"""
    normalized = name.lower().strip()
    result = await session.execute(
        select(Merchant).where(Merchant.normalized_name == normalized)
    )
    merchant = result.scalar_one_or_none()

    if not merchant:
        merchant = Merchant(name=name, normalized_name=normalized)
        session.add(merchant)
        await session.flush()

    return merchant.id


@server.list_tools()
async def list_tools() -> list[Tool]:
    """Lista as ferramentas disponíveis"""
    return [
        Tool(
            name="listar_contas",
            description="Lista todas as contas bancárias, carteiras e cartões de crédito do usuário",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="listar_categorias",
            description="Lista todas as categorias disponíveis para classificar transações (despesas e receitas)",
            inputSchema={
                "type": "object",
                "properties": {
                    "tipo": {
                        "type": "string",
                        "description": "Filtrar por tipo: 'expense' para despesas ou 'income' para receitas",
                        "enum": ["expense", "income"]
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="listar_transacoes",
            description="Lista as transações do usuário com filtros opcionais",
            inputSchema={
                "type": "object",
                "properties": {
                    "limite": {
                        "type": "integer",
                        "description": "Número máximo de transações a retornar (padrão: 20)",
                        "default": 20
                    },
                    "data_inicio": {
                        "type": "string",
                        "description": "Data inicial no formato YYYY-MM-DD"
                    },
                    "data_fim": {
                        "type": "string",
                        "description": "Data final no formato YYYY-MM-DD"
                    },
                    "categoria_id": {
                        "type": "integer",
                        "description": "ID da categoria para filtrar"
                    },
                    "conta_id": {
                        "type": "integer",
                        "description": "ID da conta para filtrar"
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="criar_transacao",
            description="Cria uma nova transação financeira (despesa, receita ou transferência)",
            inputSchema={
                "type": "object",
                "properties": {
                    "tipo": {
                        "type": "string",
                        "description": "Tipo da transação",
                        "enum": ["expense", "income", "transfer"]
                    },
                    "valor": {
                        "type": "number",
                        "description": "Valor da transação (sempre positivo)"
                    },
                    "conta_id": {
                        "type": "integer",
                        "description": "ID da conta"
                    },
                    "data": {
                        "type": "string",
                        "description": "Data da transação no formato YYYY-MM-DD (padrão: hoje)"
                    },
                    "descricao": {
                        "type": "string",
                        "description": "Descrição da transação"
                    },
                    "categoria_id": {
                        "type": "integer",
                        "description": "ID da categoria"
                    },
                    "estabelecimento": {
                        "type": "string",
                        "description": "Nome do estabelecimento/merchant"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Tags para categorização adicional"
                    },
                    "gasto_fixo": {
                        "type": "boolean",
                        "description": "Se é um gasto fixo mensal (padrão: false)"
                    },
                    "notas": {
                        "type": "string",
                        "description": "Notas adicionais sobre a transação"
                    }
                },
                "required": ["tipo", "valor", "conta_id"]
            }
        ),
        Tool(
            name="resumo_mensal",
            description="Retorna um resumo das finanças do mês atual ou especificado",
            inputSchema={
                "type": "object",
                "properties": {
                    "mes": {
                        "type": "integer",
                        "description": "Mês (1-12). Padrão: mês atual"
                    },
                    "ano": {
                        "type": "integer",
                        "description": "Ano. Padrão: ano atual"
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="listar_parcelas",
            description="Lista todas as séries de parcelas (compras parceladas) do usuário",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filtrar por status: 'active' (em andamento), 'completed' (finalizadas), 'cancelled' (canceladas)",
                        "enum": ["active", "completed", "cancelled"]
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="criar_transacao_parcelada",
            description="Cria uma transação de compra parcelada. Use quando o usuário mencionar parcelas (ex: '3/12', 'parcela 3 de 12')",
            inputSchema={
                "type": "object",
                "properties": {
                    "valor_parcela": {
                        "type": "number",
                        "description": "Valor de cada parcela"
                    },
                    "parcela_atual": {
                        "type": "integer",
                        "description": "Número da parcela atual (ex: 3 para 'parcela 3 de 12')"
                    },
                    "total_parcelas": {
                        "type": "integer",
                        "description": "Total de parcelas (ex: 12 para 'parcela 3 de 12')"
                    },
                    "conta_id": {
                        "type": "integer",
                        "description": "ID da conta/cartão"
                    },
                    "data": {
                        "type": "string",
                        "description": "Data da parcela no formato YYYY-MM-DD (padrão: hoje)"
                    },
                    "descricao": {
                        "type": "string",
                        "description": "Descrição da compra (ex: 'TV 55 polegadas Magazine Luiza')"
                    },
                    "estabelecimento": {
                        "type": "string",
                        "description": "Nome do estabelecimento"
                    },
                    "categoria_id": {
                        "type": "integer",
                        "description": "ID da categoria"
                    },
                    "marcar_anteriores_pagas": {
                        "type": "boolean",
                        "description": "Se true, marca as parcelas anteriores como já pagas (padrão: true)"
                    },
                    "criar_futuras": {
                        "type": "boolean",
                        "description": "Se true, cria as parcelas futuras como pendentes (padrão: false)"
                    }
                },
                "required": ["valor_parcela", "parcela_atual", "total_parcelas", "conta_id"]
            }
        ),
        Tool(
            name="detalhar_parcelas",
            description="Mostra detalhes de uma série de parcelas específica, incluindo status de cada parcela",
            inputSchema={
                "type": "object",
                "properties": {
                    "serie_id": {
                        "type": "integer",
                        "description": "ID da série de parcelas"
                    }
                },
                "required": ["serie_id"]
            }
        ),
        # Ferramentas de Orçamento
        Tool(
            name="ver_orcamento",
            description="Mostra o orçamento do mês com limites por categoria e gastos atuais",
            inputSchema={
                "type": "object",
                "properties": {
                    "mes": {"type": "integer", "description": "Mês (1-12). Padrão: mês atual"},
                    "ano": {"type": "integer", "description": "Ano. Padrão: ano atual"}
                },
                "required": []
            }
        ),
        Tool(
            name="definir_limite_categoria",
            description="Define o limite de orçamento para uma categoria específica no mês",
            inputSchema={
                "type": "object",
                "properties": {
                    "categoria_id": {"type": "integer", "description": "ID da categoria"},
                    "valor": {"type": "number", "description": "Valor limite para o mês"},
                    "mes": {"type": "integer", "description": "Mês (1-12). Padrão: mês atual"},
                    "ano": {"type": "integer", "description": "Ano. Padrão: ano atual"},
                    "gasto_fixo": {"type": "boolean", "description": "Se é gasto fixo (aluguel, etc). Padrão: false"}
                },
                "required": ["categoria_id", "valor"]
            }
        ),
        # Ferramentas de Metas
        Tool(
            name="listar_metas",
            description="Lista todas as metas financeiras do usuário (economia, fundo emergência, compras, etc)",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filtrar por status",
                        "enum": ["active", "completed", "paused", "cancelled"]
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="criar_meta",
            description="Cria uma nova meta financeira (economia, fundo emergência, compra, investimento, etc)",
            inputSchema={
                "type": "object",
                "properties": {
                    "nome": {"type": "string", "description": "Nome da meta (ex: 'Viagem para Europa')"},
                    "valor_alvo": {"type": "number", "description": "Valor alvo a ser atingido"},
                    "tipo": {
                        "type": "string",
                        "description": "Tipo da meta",
                        "enum": ["savings", "emergency", "debt_free", "investment", "retirement", "purchase", "custom"]
                    },
                    "data_alvo": {"type": "string", "description": "Data alvo no formato YYYY-MM-DD"},
                    "valor_inicial": {"type": "number", "description": "Valor já guardado. Padrão: 0"},
                    "descricao": {"type": "string", "description": "Descrição opcional da meta"}
                },
                "required": ["nome", "valor_alvo"]
            }
        ),
        Tool(
            name="contribuir_meta",
            description="Adiciona uma contribuição/aporte a uma meta",
            inputSchema={
                "type": "object",
                "properties": {
                    "meta_id": {"type": "integer", "description": "ID da meta"},
                    "valor": {"type": "number", "description": "Valor da contribuição"},
                    "data": {"type": "string", "description": "Data no formato YYYY-MM-DD. Padrão: hoje"},
                    "notas": {"type": "string", "description": "Notas sobre a contribuição"}
                },
                "required": ["meta_id", "valor"]
            }
        ),
        Tool(
            name="calcular_fundo_emergencia",
            description="Calcula quanto você precisa ter no fundo de emergência (metodologia Dave Ramsey)",
            inputSchema={
                "type": "object",
                "properties": {
                    "meses": {"type": "integer", "description": "Meses de reserva desejados (3-12). Padrão: 6"}
                },
                "required": []
            }
        ),
        Tool(
            name="calcular_pnif",
            description="Calcula o PNIF - Patrimônio Necessário para Independência Financeira (metodologia Gustavo Cerbasi)",
            inputSchema={
                "type": "object",
                "properties": {
                    "taxa_retorno": {"type": "number", "description": "Taxa de retorno anual esperada (ex: 0.08 para 8%). Padrão: 0.08"}
                },
                "required": []
            }
        ),
        # Ferramentas de Dívidas
        Tool(
            name="listar_dividas",
            description="Lista todas as dívidas do usuário (cartões, empréstimos, financiamentos)",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filtrar por status",
                        "enum": ["active", "paid_off", "negotiating", "defaulted"]
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="criar_divida",
            description="Registra uma nova dívida para acompanhamento",
            inputSchema={
                "type": "object",
                "properties": {
                    "nome": {"type": "string", "description": "Nome da dívida (ex: 'Cartão Nubank')"},
                    "valor_original": {"type": "number", "description": "Valor original da dívida"},
                    "saldo_atual": {"type": "number", "description": "Saldo devedor atual"},
                    "tipo": {
                        "type": "string",
                        "description": "Tipo da dívida",
                        "enum": ["credit_card", "personal_loan", "car_loan", "mortgage", "student_loan", "medical", "store_credit", "other"]
                    },
                    "taxa_juros": {"type": "number", "description": "Taxa de juros mensal (%). Ex: 12.99"},
                    "pagamento_minimo": {"type": "number", "description": "Valor do pagamento mínimo mensal"},
                    "data_inicio": {"type": "string", "description": "Data que contraiu a dívida (YYYY-MM-DD)"},
                    "dia_vencimento": {"type": "integer", "description": "Dia do vencimento (1-31)"},
                    "credor": {"type": "string", "description": "Nome do credor (banco, loja, etc)"}
                },
                "required": ["nome", "valor_original", "saldo_atual", "data_inicio"]
            }
        ),
        Tool(
            name="pagar_divida",
            description="Registra um pagamento de dívida",
            inputSchema={
                "type": "object",
                "properties": {
                    "divida_id": {"type": "integer", "description": "ID da dívida"},
                    "valor": {"type": "number", "description": "Valor do pagamento"},
                    "data": {"type": "string", "description": "Data do pagamento (YYYY-MM-DD). Padrão: hoje"},
                    "notas": {"type": "string", "description": "Notas sobre o pagamento"}
                },
                "required": ["divida_id", "valor"]
            }
        ),
        Tool(
            name="plano_quitar_dividas",
            description="Gera plano para quitar dívidas usando método Snowball (Dave Ramsey) ou Avalanche",
            inputSchema={
                "type": "object",
                "properties": {
                    "valor_mensal": {"type": "number", "description": "Valor total disponível por mês para pagar dívidas"},
                    "metodo": {
                        "type": "string",
                        "description": "Método de quitação. Snowball: menor saldo primeiro (motivacional). Avalanche: maior juros primeiro (matemático)",
                        "enum": ["snowball", "avalanche", "comparar"]
                    }
                },
                "required": ["valor_mensal"]
            }
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Executa uma ferramenta"""

    async with async_session() as session:
        try:
            user = await get_default_user(session)
            if not user:
                return [TextContent(
                    type="text",
                    text="Erro: Nenhum usuário encontrado. Por favor, crie um usuário primeiro via a aplicação web."
                )]

            if name == "listar_contas":
                return await _listar_contas(session, user)

            elif name == "listar_categorias":
                return await _listar_categorias(session, arguments.get("tipo"))

            elif name == "listar_transacoes":
                return await _listar_transacoes(session, user, arguments)

            elif name == "criar_transacao":
                return await _criar_transacao(session, user, arguments)

            elif name == "resumo_mensal":
                return await _resumo_mensal(session, user, arguments)

            elif name == "listar_parcelas":
                return await _listar_parcelas(session, user, arguments)

            elif name == "criar_transacao_parcelada":
                return await _criar_transacao_parcelada(session, user, arguments)

            elif name == "detalhar_parcelas":
                return await _detalhar_parcelas(session, user, arguments)

            # Orçamento
            elif name == "ver_orcamento":
                return await _ver_orcamento(session, user, arguments)

            elif name == "definir_limite_categoria":
                return await _definir_limite_categoria(session, user, arguments)

            # Metas
            elif name == "listar_metas":
                return await _listar_metas(session, user, arguments)

            elif name == "criar_meta":
                return await _criar_meta(session, user, arguments)

            elif name == "contribuir_meta":
                return await _contribuir_meta(session, user, arguments)

            elif name == "calcular_fundo_emergencia":
                return await _calcular_fundo_emergencia(session, user, arguments)

            elif name == "calcular_pnif":
                return await _calcular_pnif(session, user, arguments)

            # Dívidas
            elif name == "listar_dividas":
                return await _listar_dividas(session, user, arguments)

            elif name == "criar_divida":
                return await _criar_divida(session, user, arguments)

            elif name == "pagar_divida":
                return await _pagar_divida(session, user, arguments)

            elif name == "plano_quitar_dividas":
                return await _plano_quitar_dividas(session, user, arguments)

            else:
                return [TextContent(type="text", text=f"Ferramenta desconhecida: {name}")]

        except Exception as e:
            await session.rollback()
            return [TextContent(type="text", text=f"Erro: {str(e)}")]


async def _listar_contas(session: AsyncSession, user: User) -> list[TextContent]:
    """Lista as contas do usuário"""
    result = await session.execute(
        select(Account).where(
            Account.user_id == user.id,
            Account.is_active == True
        ).order_by(Account.name)
    )
    accounts = result.scalars().all()

    if not accounts:
        return [TextContent(type="text", text="Nenhuma conta encontrada.")]

    output = "**Contas Disponíveis:**\n\n"
    for acc in accounts:
        tipo_map = {
            "wallet": "💵 Carteira",
            "bank": "🏦 Conta Bancária",
            "credit_card": "💳 Cartão de Crédito",
            "investment": "📈 Investimento"
        }
        tipo = tipo_map.get(acc.type, acc.type)
        output += f"- **ID {acc.id}**: {acc.name} ({tipo}) - Saldo: R$ {acc.balance:,.2f}\n"

    return [TextContent(type="text", text=output)]


async def _listar_categorias(session: AsyncSession, tipo: str | None) -> list[TextContent]:
    """Lista as categorias disponíveis"""
    query = select(Category).order_by(Category.type, Category.name)

    if tipo:
        query = query.where(Category.type == tipo)

    result = await session.execute(query)
    categories = result.scalars().all()

    if not categories:
        return [TextContent(type="text", text="Nenhuma categoria encontrada.")]

    output = "**Categorias Disponíveis:**\n\n"

    # Agrupar por tipo
    despesas = [c for c in categories if c.type == "expense"]
    receitas = [c for c in categories if c.type == "income"]

    if despesas:
        output += "📉 **Despesas:**\n"
        for cat in despesas:
            icon = cat.icon or "•"
            output += f"  - **ID {cat.id}**: {icon} {cat.name}\n"

    if receitas:
        output += "\n📈 **Receitas:**\n"
        for cat in receitas:
            icon = cat.icon or "•"
            output += f"  - **ID {cat.id}**: {icon} {cat.name}\n"

    return [TextContent(type="text", text=output)]


async def _listar_transacoes(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Lista transações do usuário"""
    query = select(Transaction).where(Transaction.user_id == user.id)

    # Aplicar filtros
    if args.get("data_inicio"):
        data_inicio = date.fromisoformat(args["data_inicio"])
        query = query.where(Transaction.date >= data_inicio)

    if args.get("data_fim"):
        data_fim = date.fromisoformat(args["data_fim"])
        query = query.where(Transaction.date <= data_fim)

    if args.get("categoria_id"):
        query = query.where(Transaction.category_id == args["categoria_id"])

    if args.get("conta_id"):
        query = query.where(Transaction.account_id == args["conta_id"])

    limite = args.get("limite", 20)
    query = query.order_by(Transaction.date.desc()).limit(limite)

    result = await session.execute(query)
    transactions = result.scalars().all()

    if not transactions:
        return [TextContent(type="text", text="Nenhuma transação encontrada.")]

    output = f"**Últimas {len(transactions)} Transações:**\n\n"

    for t in transactions:
        tipo_icon = {"expense": "🔴", "income": "🟢", "transfer": "🔄"}.get(t.type, "•")
        sinal = "-" if t.type == "expense" else "+" if t.type == "income" else ""

        output += f"{tipo_icon} **{t.date.strftime('%d/%m/%Y')}** | {sinal}R$ {t.amount:,.2f}"
        if t.description:
            output += f" | {t.description}"
        output += f" (ID: {t.id})\n"

    return [TextContent(type="text", text=output)]


async def _criar_transacao(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Cria uma nova transação"""
    # Validar conta
    result = await session.execute(
        select(Account).where(
            Account.id == args["conta_id"],
            Account.user_id == user.id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        return [TextContent(type="text", text=f"Erro: Conta com ID {args['conta_id']} não encontrada.")]

    # Validar categoria se fornecida
    category_id = args.get("categoria_id")
    if category_id:
        result = await session.execute(
            select(Category).where(Category.id == category_id)
        )
        if not result.scalar_one_or_none():
            return [TextContent(type="text", text=f"Erro: Categoria com ID {category_id} não encontrada.")]

    # Obter ou criar merchant
    merchant_id = None
    if args.get("estabelecimento"):
        merchant_id = await get_or_create_merchant(session, args["estabelecimento"])

    # Processar data
    if args.get("data"):
        transaction_date = date.fromisoformat(args["data"])
    else:
        transaction_date = date.today()

    # Criar transação
    transaction = Transaction(
        user_id=user.id,
        account_id=args["conta_id"],
        category_id=category_id,
        merchant_id=merchant_id,
        type=args["tipo"],
        amount=abs(args["valor"]),  # Sempre positivo
        currency="BRL",
        date=transaction_date,
        description=args.get("descricao"),
        notes=args.get("notas"),
        tags=args.get("tags"),
        is_fixed=args.get("gasto_fixo", False),
    )

    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)

    tipo_nome = {"expense": "Despesa", "income": "Receita", "transfer": "Transferência"}.get(args["tipo"], args["tipo"])

    output = f"✅ **{tipo_nome} criada com sucesso!**\n\n"
    output += f"- **ID:** {transaction.id}\n"
    output += f"- **Valor:** R$ {transaction.amount:,.2f}\n"
    output += f"- **Data:** {transaction.date.strftime('%d/%m/%Y')}\n"
    output += f"- **Conta:** {account.name}\n"
    if args.get("descricao"):
        output += f"- **Descrição:** {args['descricao']}\n"
    if args.get("estabelecimento"):
        output += f"- **Estabelecimento:** {args['estabelecimento']}\n"

    return [TextContent(type="text", text=output)]


async def _resumo_mensal(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Retorna resumo financeiro do mês"""
    hoje = date.today()
    mes = args.get("mes", hoje.month)
    ano = args.get("ano", hoje.year)

    # Definir intervalo do mês
    from calendar import monthrange
    primeiro_dia = date(ano, mes, 1)
    ultimo_dia = date(ano, mes, monthrange(ano, mes)[1])

    # Buscar transações do mês
    result = await session.execute(
        select(Transaction).where(
            Transaction.user_id == user.id,
            Transaction.date >= primeiro_dia,
            Transaction.date <= ultimo_dia
        )
    )
    transactions = result.scalars().all()

    # Calcular totais
    total_receitas = sum(t.amount for t in transactions if t.type == "income")
    total_despesas = sum(t.amount for t in transactions if t.type == "expense")
    saldo = total_receitas - total_despesas

    # Agrupar despesas por categoria
    despesas_por_categoria: dict[str, float] = {}
    for t in transactions:
        if t.type == "expense":
            cat_name = "Sem categoria"
            if t.category:
                cat_name = t.category.name
            despesas_por_categoria[cat_name] = despesas_por_categoria.get(cat_name, 0) + t.amount

    # Ordenar por valor
    despesas_ordenadas = sorted(despesas_por_categoria.items(), key=lambda x: x[1], reverse=True)

    meses_pt = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

    output = f"📊 **Resumo Financeiro - {meses_pt[mes]} {ano}**\n\n"
    output += f"🟢 **Total de Receitas:** R$ {total_receitas:,.2f}\n"
    output += f"🔴 **Total de Despesas:** R$ {total_despesas:,.2f}\n"

    if saldo >= 0:
        output += f"💰 **Saldo do Mês:** +R$ {saldo:,.2f}\n"
    else:
        output += f"💸 **Saldo do Mês:** -R$ {abs(saldo):,.2f}\n"

    output += f"\n📝 **Total de Transações:** {len(transactions)}\n"

    if despesas_ordenadas:
        output += "\n**Despesas por Categoria:**\n"
        for cat_name, valor in despesas_ordenadas[:5]:
            pct = (valor / total_despesas * 100) if total_despesas > 0 else 0
            output += f"  • {cat_name}: R$ {valor:,.2f} ({pct:.1f}%)\n"

    return [TextContent(type="text", text=output)]


async def _listar_parcelas(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Lista séries de parcelas do usuário"""
    installment_service = InstallmentService(session)

    status_filter = None
    if args.get("status"):
        try:
            status_filter = InstallmentSeriesStatus(args["status"])
        except ValueError:
            pass

    series_list = await installment_service.get_user_series(
        user=user,
        status_filter=status_filter,
        limit=50,
    )

    if not series_list:
        return [TextContent(type="text", text="Nenhuma compra parcelada encontrada.")]

    output = "**Compras Parceladas:**\n\n"

    for series in series_list:
        status_icon = {
            "active": "🔄",
            "completed": "✅",
            "cancelled": "❌"
        }.get(series.status, "•")

        output += f"{status_icon} **{series.description}**\n"
        output += f"   • ID: {series.id} | {series.merchant_name}\n"
        output += f"   • Parcelas: {series.paid_count}/{series.installment_count} pagas\n"
        output += f"   • Valor parcela: R$ {series.installment_amount:,.2f}\n"
        output += f"   • Restante: R$ {series.remaining_amount:,.2f} ({series.remaining_count} parcelas)\n"
        output += f"   • Total: R$ {series.total_amount:,.2f}\n\n"

    return [TextContent(type="text", text=output)]


async def _criar_transacao_parcelada(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """
    Cria uma transação parcelada - NOVO FLUXO.

    Fluxo corrigido:
    1. Criar transação primeiro (sem série)
    2. Criar série vinculada a esta transação
    3. Vincular transação à série
    4. Criar parcelas futuras se solicitado

    Isso garante que cada compra tenha sua própria série, mesmo quando
    têm mesmo merchant, valor e total de parcelas.
    """
    from dateutil.relativedelta import relativedelta
    from app.models.transaction import Transaction, TransactionType

    installment_service = InstallmentService(session)

    # Validar conta
    result = await session.execute(
        select(Account).where(
            Account.id == args["conta_id"],
            Account.user_id == user.id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        return [TextContent(type="text", text=f"Erro: Conta com ID {args['conta_id']} não encontrada.")]

    # Processar data
    if args.get("data"):
        transaction_date = date.fromisoformat(args["data"])
    else:
        transaction_date = date.today()

    parcela_atual = args["parcela_atual"]
    total_parcelas = args["total_parcelas"]
    valor_parcela = args["valor_parcela"]
    descricao = args.get("descricao") or args.get("estabelecimento") or "Compra parcelada"
    merchant_name = args.get("estabelecimento") or descricao
    category_id = args.get("categoria_id")
    marcar_anteriores = args.get("marcar_anteriores_pagas", True)
    criar_futuras = args.get("criar_futuras", False)

    output = ""
    transactions_created = []

    # NOVO FLUXO: Criar transação primeiro, depois criar série vinculada a ela

    # PASSO 1: Criar a transação primeiro (sem série)
    transaction = Transaction(
        user_id=user.id,
        account_id=args["conta_id"],
        category_id=category_id,
        type=TransactionType.EXPENSE,
        amount=valor_parcela,
        date=transaction_date,
        description=descricao,
        installment_number=parcela_atual,
        installment_total=total_parcelas,
        is_paid=True,
        is_fixed=True,
    )
    session.add(transaction)
    await session.flush()
    await session.refresh(transaction)

    # PASSO 2: Criar série vinculada a ESTA transação
    first_installment_date = transaction_date - relativedelta(months=parcela_atual - 1)

    series = await installment_service.create_series(
        user=user,
        description=descricao,
        merchant_name=merchant_name,
        installment_amount=valor_parcela,
        installment_count=total_parcelas,
        first_installment_date=first_installment_date,
        account_id=args["conta_id"],
        category_id=category_id,
        first_transaction_id=transaction.id,  # VINCULA À TRANSAÇÃO
    )

    # PASSO 3: Vincular transação à série e incrementar paid_count
    transaction.installment_series_id = series.id
    series.paid_count += 1

    transactions_created.append(transaction)

    # Marcar anteriores como pagas
    if marcar_anteriores and parcela_atual > 1:
        previous = await installment_service.mark_previous_installments_as_paid(
            user=user,
            series=series,
            up_to_installment=parcela_atual,
        )
        transactions_created.extend(previous)
        if previous:
            output += f"Parcelas 1 a {parcela_atual - 1} marcadas como pagas (retroativamente)\n"

    # PASSO 4: Criar futuras se solicitado
    if criar_futuras:
        future = await installment_service.create_future_installments(
            user=user,
            series=series,
            from_installment=parcela_atual,
        )
        transactions_created.extend(future)
        if future:
            output += f"Criadas {len(future)} parcelas futuras como pendentes\n"

    await session.commit()

    output = f"**Parcela {parcela_atual}/{total_parcelas} cadastrada!**\n\n"
    output += f"**{descricao}**\n"
    output += f"- Valor da parcela: R$ {valor_parcela:,.2f}\n"
    output += f"- Conta: {account.name}\n"
    output += f"- Data: {transaction_date.strftime('%d/%m/%Y')}\n"
    output += f"- Serie ID: {series.id}\n\n"

    output += f"Nova serie de parcelas criada (vinculada a transacao {transaction.id})\n"

    output += f"\n**Status da serie:**\n"
    output += f"- Pagas: {series.paid_count}/{series.installment_count}\n"
    output += f"- Valor restante: R$ {series.remaining_amount:,.2f}\n"
    output += f"- Total da compra: R$ {series.total_amount:,.2f}\n"

    return [TextContent(type="text", text=output)]


async def _detalhar_parcelas(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Mostra detalhes de uma série de parcelas"""
    installment_service = InstallmentService(session)

    series = await installment_service.get_series_by_id(user, args["serie_id"])
    if not series:
        return [TextContent(type="text", text=f"Erro: Série com ID {args['serie_id']} não encontrada.")]

    status_data = await installment_service.get_series_status(series)

    output = f"📦 **{series.description}**\n\n"
    output += f"- Estabelecimento: {series.merchant_name}\n"
    output += f"- Total da compra: R$ {series.total_amount:,.2f}\n"
    output += f"- Valor por parcela: R$ {series.installment_amount:,.2f}\n"
    output += f"- Primeira parcela: {series.first_installment_date.strftime('%d/%m/%Y')}\n\n"

    output += f"**Progresso:** {series.paid_count}/{series.installment_count} parcelas pagas\n"
    output += f"**Restante:** R$ {series.remaining_amount:,.2f}\n\n"

    output += "**Detalhamento das parcelas:**\n"

    for inst in status_data["installments"]:
        num = inst["number"]
        status = inst["status"]

        if status == "paid":
            icon = "✅"
            info = f"Paga em {inst['date']}" if inst.get('date') else "Paga"
        elif status == "registered":
            icon = "📝"
            info = "Registrada (não paga)"
        else:
            icon = "⏳"
            info = f"Prevista para {inst.get('expected_date', 'N/A')}"

        output += f"  {icon} Parcela {num}/{series.installment_count}: {info}\n"

    return [TextContent(type="text", text=output)]


# ========================== ORÇAMENTO ==========================

async def _ver_orcamento(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Mostra o orçamento do mês"""
    hoje = date.today()
    mes = args.get("mes", hoje.month)
    ano = args.get("ano", hoje.year)

    budget_service = BudgetService(session)
    budget = await budget_service.get_budget(user, ano, mes)

    meses_pt = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

    output = f"📊 **Orçamento - {meses_pt[mes]} {ano}**\n\n"

    if not budget or not budget.items:
        output += "⚠️ Nenhum limite definido ainda.\n"
        output += "Use `definir_limite_categoria` para criar seu orçamento.\n"
        return [TextContent(type="text", text=output)]

    output += f"💰 **Receita Planejada:** R$ {budget.total_income_planned:,.2f}\n"
    output += f"📝 **Despesas Planejadas:** R$ {budget.total_expense_planned:,.2f}\n"
    output += f"💸 **Total Gasto:** R$ {budget.total_spent:,.2f}\n"
    output += f"✅ **Disponível:** R$ {budget.total_available:,.2f}\n"
    output += f"📈 **Saúde do Orçamento:** {budget.health_score:.0f}/100\n\n"

    output += "**Por Categoria:**\n"
    for item in sorted(budget.items, key=lambda x: x.spent_amount, reverse=True):
        if item.available_amount < 0:
            icon = "🔴"
        elif item.percentage_used > 80:
            icon = "🟡"
        else:
            icon = "🟢"

        cat_name = item.category_name or f"Cat {item.category_id}"
        output += f"{icon} **{cat_name}:** R$ {item.spent_amount:,.2f} / R$ {item.planned_amount:,.2f}"
        output += f" ({item.percentage_used:.0f}%)\n"

    return [TextContent(type="text", text=output)]


async def _definir_limite_categoria(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Define limite de orçamento para uma categoria"""
    from app.schemas.budget import BudgetItemCreate

    hoje = date.today()
    mes = args.get("mes", hoje.month)
    ano = args.get("ano", hoje.year)

    budget_service = BudgetService(session)

    item_data = BudgetItemCreate(
        category_id=args["categoria_id"],
        planned_amount=args["valor"],
        is_fixed=args.get("gasto_fixo", False)
    )

    try:
        item = await budget_service.add_budget_item(user, ano, mes, item_data)
        await session.commit()

        # Buscar nome da categoria
        result = await session.execute(
            select(Category.name).where(Category.id == args["categoria_id"])
        )
        cat_name = result.scalar_one_or_none() or f"Categoria {args['categoria_id']}"

        output = f"✅ **Limite definido!**\n\n"
        output += f"📂 **Categoria:** {cat_name}\n"
        output += f"💰 **Limite:** R$ {args['valor']:,.2f}\n"
        output += f"📅 **Período:** {mes}/{ano}\n"

        if args.get("gasto_fixo"):
            output += "🔒 Marcado como gasto fixo\n"

        return [TextContent(type="text", text=output)]

    except Exception as e:
        if "já existe" in str(e).lower():
            # Atualizar ao invés de criar
            from app.schemas.budget import BudgetItemUpdate
            budget = await budget_service.get_or_create_budget(user, ano, mes)

            # Encontrar item existente
            existing_item = next(
                (i for i in budget.items if i.category_id == args["categoria_id"]),
                None
            )

            if existing_item:
                await budget_service.update_budget_item(
                    user, existing_item.id,
                    BudgetItemUpdate(planned_amount=args["valor"], is_fixed=args.get("gasto_fixo"))
                )
                await session.commit()
                return [TextContent(type="text", text=f"✅ Limite atualizado para R$ {args['valor']:,.2f}")]

        raise


# ========================== METAS ==========================

async def _listar_metas(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Lista metas do usuário"""
    goal_service = GoalService(session)

    status_filter = None
    if args.get("status"):
        try:
            status_filter = GoalStatus(args["status"])
        except ValueError:
            pass

    goals = await goal_service.list_goals(user, status_filter)

    if not goals:
        return [TextContent(type="text", text="Nenhuma meta encontrada. Use `criar_meta` para criar uma!")]

    # Buscar resumo
    summary = await goal_service.get_summary(user)

    output = f"🎯 **Suas Metas Financeiras**\n\n"
    output += f"📊 Progresso Geral: {summary.overall_progress:.1f}%\n"
    output += f"💰 Total Guardado: R$ {summary.total_saved:,.2f} de R$ {summary.total_target:,.2f}\n"
    output += f"📝 Metas Ativas: {summary.active_goals} | Concluídas: {summary.completed_goals}\n\n"

    for goal in goals:
        status_icon = {
            "active": "🟢",
            "completed": "✅",
            "paused": "⏸️",
            "cancelled": "❌"
        }.get(goal.status.value, "•")

        type_icon = {
            "savings": "💰",
            "emergency": "🆘",
            "debt_free": "🔓",
            "investment": "📈",
            "retirement": "🏖️",
            "purchase": "🛒",
            "custom": "🎯"
        }.get(goal.type.value, "🎯")

        output += f"{status_icon} {type_icon} **{goal.name}** (ID: {goal.id})\n"
        output += f"   Progresso: {goal.progress_percentage:.1f}% "
        output += f"(R$ {goal.current_amount:,.2f} / R$ {goal.target_amount:,.2f})\n"

        if goal.target_date:
            output += f"   Prazo: {goal.target_date.strftime('%d/%m/%Y')}"
            if goal.on_track:
                output += " ✓ No caminho certo\n"
            else:
                output += " ⚠️ Atrasada\n"
        else:
            output += "\n"

        if goal.suggested_monthly:
            output += f"   Contribuição sugerida: R$ {goal.suggested_monthly:,.2f}/mês\n"

        output += "\n"

    return [TextContent(type="text", text=output)]


async def _criar_meta(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Cria uma nova meta"""
    from app.schemas.goal import GoalCreate
    from decimal import Decimal

    goal_service = GoalService(session)

    data_alvo = None
    if args.get("data_alvo"):
        data_alvo = date.fromisoformat(args["data_alvo"])

    goal_data = GoalCreate(
        name=args["nome"],
        target_amount=Decimal(str(args["valor_alvo"])),
        type=GoalType(args.get("tipo", "savings")),
        target_date=data_alvo,
        initial_amount=Decimal(str(args.get("valor_inicial", 0))),
        description=args.get("descricao")
    )

    goal = await goal_service.create_goal(user, goal_data)
    await session.commit()

    type_names = {
        "savings": "Economia",
        "emergency": "Fundo de Emergência",
        "debt_free": "Quitar Dívidas",
        "investment": "Investimento",
        "retirement": "Aposentadoria",
        "purchase": "Compra",
        "custom": "Personalizada"
    }

    output = f"✅ **Meta criada com sucesso!**\n\n"
    output += f"🎯 **{goal.name}** (ID: {goal.id})\n"
    output += f"📂 Tipo: {type_names.get(goal.type, goal.type)}\n"
    output += f"💰 Valor Alvo: R$ {goal.target_amount:,.2f}\n"

    if goal.current_amount > 0:
        output += f"💵 Valor Inicial: R$ {goal.current_amount:,.2f}\n"

    if data_alvo:
        output += f"📅 Prazo: {data_alvo.strftime('%d/%m/%Y')}\n"
        if goal.monthly_contribution:
            output += f"💳 Contribuição Mensal Sugerida: R$ {goal.monthly_contribution:,.2f}\n"

    return [TextContent(type="text", text=output)]


async def _contribuir_meta(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Adiciona contribuição a uma meta"""
    from app.schemas.goal import GoalContributionCreate
    from decimal import Decimal

    goal_service = GoalService(session)

    contrib_date = date.today()
    if args.get("data"):
        contrib_date = date.fromisoformat(args["data"])

    contrib_data = GoalContributionCreate(
        amount=Decimal(str(args["valor"])),
        contribution_date=contrib_date,
        notes=args.get("notas")
    )

    contribution = await goal_service.add_contribution(user, args["meta_id"], contrib_data)
    await session.commit()

    # Buscar meta atualizada
    goal = await goal_service.get_goal(user, args["meta_id"])

    output = f"✅ **Contribuição registrada!**\n\n"
    output += f"🎯 Meta: {goal.name}\n"
    output += f"💵 Valor: R$ {args['valor']:,.2f}\n"
    output += f"📊 Novo Progresso: {goal.progress_percentage:.1f}%\n"
    output += f"💰 Total Acumulado: R$ {goal.current_amount:,.2f} / R$ {goal.target_amount:,.2f}\n"
    output += f"📉 Restante: R$ {goal.remaining_amount:,.2f}\n"

    if goal.progress_percentage >= 100:
        output += "\n🎉 **PARABÉNS! Meta concluída!**\n"

    return [TextContent(type="text", text=output)]


async def _calcular_fundo_emergencia(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Calcula fundo de emergência"""
    goal_service = GoalService(session)
    meses = args.get("meses", 6)

    calc = await goal_service.calculate_emergency_fund(user, meses)

    status_emoji = {
        "complete": "✅",
        "partial": "🟡",
        "starter": "🟠",
        "none": "🔴"
    }

    status_text = {
        "complete": "Completo! Você tem reserva para 6+ meses",
        "partial": "Parcial. Você está no caminho certo!",
        "starter": "Inicial. Continue poupando!",
        "none": "Não iniciado. Hora de começar!"
    }

    output = f"🆘 **Fundo de Emergência (Baby Step 3 - Dave Ramsey)**\n\n"
    output += f"📊 **Sua Situação:**\n"
    output += f"💸 Despesas Mensais Médias: R$ {calc.monthly_expenses:,.2f}\n"
    output += f"💰 Reserva Atual: R$ {calc.current_saved:,.2f}\n"
    output += f"📅 Meses Cobertos: {calc.months_covered:.1f}\n"
    output += f"{status_emoji[calc.status]} Status: {status_text[calc.status]}\n\n"

    output += f"**Recomendações:**\n"
    output += f"• Reserva mínima (3 meses): R$ {calc.recommended_3_months:,.2f}\n"
    output += f"• Reserva ideal (6 meses): R$ {calc.recommended_6_months:,.2f}\n"

    if calc.current_saved < calc.recommended_6_months:
        falta = calc.recommended_6_months - calc.current_saved
        output += f"\n💡 Falta R$ {falta:,.2f} para a reserva ideal de 6 meses.\n"

    return [TextContent(type="text", text=output)]


async def _calcular_pnif(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Calcula PNIF - Patrimônio Necessário para Independência Financeira"""
    goal_service = GoalService(session)
    taxa = args.get("taxa_retorno", 0.08)

    calc = await goal_service.calculate_pnif(user, taxa)

    output = f"🏖️ **PNIF - Independência Financeira (Gustavo Cerbasi)**\n\n"
    output += f"📐 **Fórmula:** PNIF = Gasto Anual / Taxa de Retorno\n\n"

    output += f"📊 **Seus Números:**\n"
    output += f"💸 Gastos Anuais: R$ {calc.annual_expenses:,.2f}\n"
    output += f"📈 Taxa de Retorno Esperada: {calc.expected_return_rate * 100:.1f}% a.a.\n"
    output += f"🎯 **PNIF Necessário: R$ {calc.pnif_amount:,.2f}**\n\n"

    output += f"💰 Patrimônio Atual: R$ {calc.current_net_worth:,.2f}\n"
    output += f"📊 Progresso: {calc.percentage_achieved:.1f}%\n"

    if calc.years_to_pnif:
        output += f"⏱️ Anos até PNIF (ritmo atual): ~{calc.years_to_pnif} anos\n"

    if calc.monthly_savings_needed:
        output += f"\n💡 Para atingir em 20 anos, poupe R$ {calc.monthly_savings_needed:,.2f}/mês\n"

    return [TextContent(type="text", text=output)]


# ========================== DÍVIDAS ==========================

async def _listar_dividas(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Lista dívidas do usuário"""
    debt_service = DebtService(session)

    status_filter = None
    if args.get("status"):
        try:
            status_filter = DebtStatus(args["status"])
        except ValueError:
            pass

    debts = await debt_service.list_debts(user, status_filter)

    if not debts:
        return [TextContent(type="text", text="🎉 Nenhuma dívida registrada! Continue assim!")]

    summary = await debt_service.get_summary(user)

    output = f"💳 **Suas Dívidas**\n\n"
    output += f"📊 Total Devido: R$ {summary.total_owed:,.2f}\n"
    output += f"💸 Pagamentos Mínimos: R$ {summary.total_minimum_payments:,.2f}/mês\n"
    output += f"📈 Juros Mensais: R$ {summary.total_interest_monthly:,.2f}/mês\n"

    if summary.debt_free_date:
        output += f"📅 Livre de dívidas em: ~{summary.debt_free_date.strftime('%m/%Y')}\n"

    output += f"\n**Dívidas Ativas ({summary.active_debts}):**\n\n"

    for debt in debts:
        status_icon = {
            "active": "🔴",
            "paid_off": "✅",
            "negotiating": "🟡",
            "defaulted": "⚫"
        }.get(debt.status.value, "•")

        type_icon = {
            "credit_card": "💳",
            "personal_loan": "💵",
            "car_loan": "🚗",
            "mortgage": "🏠",
            "student_loan": "🎓",
            "store_credit": "🛒"
        }.get(debt.type.value, "💰")

        output += f"{status_icon} {type_icon} **{debt.name}** (ID: {debt.id})\n"
        output += f"   Saldo: R$ {debt.current_balance:,.2f}"
        if debt.interest_rate > 0:
            output += f" | Juros: {debt.interest_rate:.2f}%/mês"
        output += f"\n"
        output += f"   Progresso: {debt.progress_percentage:.1f}% quitado\n"

        if debt.minimum_payment > 0:
            output += f"   Pagamento Mínimo: R$ {debt.minimum_payment:,.2f}\n"

        output += "\n"

    return [TextContent(type="text", text=output)]


async def _criar_divida(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Registra uma nova dívida"""
    from app.schemas.debt import DebtCreate
    from decimal import Decimal

    debt_service = DebtService(session)

    debt_data = DebtCreate(
        name=args["nome"],
        original_amount=Decimal(str(args["valor_original"])),
        current_balance=Decimal(str(args["saldo_atual"])),
        type=DebtType(args.get("tipo", "other")),
        interest_rate=Decimal(str(args.get("taxa_juros", 0))),
        minimum_payment=Decimal(str(args.get("pagamento_minimo", 0))),
        start_date=date.fromisoformat(args["data_inicio"]),
        due_day=args.get("dia_vencimento"),
        creditor=args.get("credor")
    )

    debt = await debt_service.create_debt(user, debt_data)
    await session.commit()

    output = f"✅ **Dívida registrada!**\n\n"
    output += f"💳 **{debt.name}** (ID: {debt.id})\n"
    output += f"💰 Valor Original: R$ {debt.original_amount:,.2f}\n"
    output += f"📉 Saldo Atual: R$ {debt.current_balance:,.2f}\n"

    if debt.interest_rate > 0:
        output += f"📈 Taxa de Juros: {debt.interest_rate:.2f}%/mês\n"
        output += f"💸 Juros Mensais: ~R$ {debt.monthly_interest_amount:,.2f}\n"

    if debt.minimum_payment > 0:
        output += f"💵 Pagamento Mínimo: R$ {debt.minimum_payment:,.2f}\n"

    output += f"\n💡 Use `plano_quitar_dividas` para criar um plano de quitação!"

    return [TextContent(type="text", text=output)]


async def _pagar_divida(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Registra pagamento de dívida"""
    from app.schemas.debt import DebtPaymentCreate
    from decimal import Decimal

    debt_service = DebtService(session)

    payment_date = date.today()
    if args.get("data"):
        payment_date = date.fromisoformat(args["data"])

    payment_data = DebtPaymentCreate(
        amount=Decimal(str(args["valor"])),
        payment_date=payment_date,
        notes=args.get("notas")
    )

    payment = await debt_service.add_payment(user, args["divida_id"], payment_data)
    await session.commit()

    # Buscar dívida atualizada
    debt = await debt_service.get_debt(user, args["divida_id"])

    output = f"✅ **Pagamento registrado!**\n\n"
    output += f"💳 Dívida: {debt.name}\n"
    output += f"💵 Valor Pago: R$ {args['valor']:,.2f}\n"
    output += f"📉 Novo Saldo: R$ {debt.current_balance:,.2f}\n"
    output += f"📊 Progresso: {debt.progress_percentage:.1f}% quitado\n"

    if debt.current_balance <= 0:
        output += "\n🎉 **PARABÉNS! Dívida quitada!**\n"

    return [TextContent(type="text", text=output)]


async def _plano_quitar_dividas(session: AsyncSession, user: User, args: dict) -> list[TextContent]:
    """Gera plano de quitação de dívidas"""
    from decimal import Decimal

    debt_service = DebtService(session)
    valor_mensal = Decimal(str(args["valor_mensal"]))
    metodo = args.get("metodo", "comparar")

    if metodo == "comparar":
        comparison = await debt_service.compare_strategies(user, valor_mensal)

        output = f"📊 **Comparação de Estratégias de Quitação**\n\n"
        output += f"💰 Valor disponível por mês: R$ {valor_mensal:,.2f}\n\n"

        # Snowball
        output += f"❄️ **Método Snowball (Dave Ramsey)**\n"
        output += f"   • Ordem: Menor saldo primeiro\n"
        output += f"   • Tempo: {comparison.snowball.total_months} meses\n"
        output += f"   • Total de Juros: R$ {comparison.snowball.total_interest:,.2f}\n"
        output += f"   • Livre em: {comparison.snowball.debt_free_date.strftime('%m/%Y')}\n\n"

        # Avalanche
        output += f"🏔️ **Método Avalanche**\n"
        output += f"   • Ordem: Maior juros primeiro\n"
        output += f"   • Tempo: {comparison.avalanche.total_months} meses\n"
        output += f"   • Total de Juros: R$ {comparison.avalanche.total_interest:,.2f}\n"
        output += f"   • Livre em: {comparison.avalanche.debt_free_date.strftime('%m/%Y')}\n"
        output += f"   • Economia vs Snowball: R$ {comparison.avalanche.interest_saved_vs_snowball:,.2f}\n\n"

        output += f"✅ **Recomendação: {comparison.recommendation.upper()}**\n"
        output += f"   {comparison.recommendation_reason}\n"

    elif metodo == "snowball":
        plan = await debt_service.get_snowball_plan(user, valor_mensal)

        output = f"❄️ **Plano Snowball (Dave Ramsey)**\n\n"
        output += f"💰 Pagamento Mensal: R$ {valor_mensal:,.2f}\n"
        output += f"⏱️ Tempo Total: {plan.total_months} meses\n"
        output += f"💸 Total de Juros: R$ {plan.total_interest:,.2f}\n"
        output += f"📅 Livre de Dívidas: {plan.debt_free_date.strftime('%d/%m/%Y')}\n\n"

        output += f"**Ordem de Quitação:**\n"
        for step in plan.debts_order:
            output += f"{step.order}. **{step.debt_name}**\n"
            output += f"   Saldo: R$ {step.starting_balance:,.2f} | "
            output += f"Quitação: {step.payoff_date.strftime('%m/%Y')}\n"

    else:  # avalanche
        plan = await debt_service.get_avalanche_plan(user, valor_mensal)

        output = f"🏔️ **Plano Avalanche**\n\n"
        output += f"💰 Pagamento Mensal: R$ {valor_mensal:,.2f}\n"
        output += f"⏱️ Tempo Total: {plan.total_months} meses\n"
        output += f"💸 Total de Juros: R$ {plan.total_interest:,.2f}\n"
        output += f"📅 Livre de Dívidas: {plan.debt_free_date.strftime('%d/%m/%Y')}\n\n"

        output += f"**Ordem de Quitação (maior juros primeiro):**\n"
        for step in plan.debts_order:
            output += f"{step.order}. **{step.debt_name}** ({step.interest_rate:.2f}%)\n"
            output += f"   Saldo: R$ {step.starting_balance:,.2f} | "
            output += f"Quitação: {step.payoff_date.strftime('%m/%Y')}\n"

    return [TextContent(type="text", text=output)]


async def main():
    """Inicia o servidor MCP"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
