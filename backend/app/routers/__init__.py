from fastapi import APIRouter
from .auth import router as auth_router
from .users import router as users_router
from .accounts import router as accounts_router
from .categories import router as categories_router
from .transactions import router as transactions_router
from .documents import router as documents_router
from .analytics import router as analytics_router
from .installments import router as installments_router
from .budgets import router as budgets_router
from .goals import router as goals_router
from .debts import router as debts_router
from .chat import router as chat_router
from .admin import router as admin_router
from .recurring import router as recurring_router
from .family import router as family_router
from .credit_cards import router as credit_cards_router
from .income_sources import router as income_sources_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(users_router, prefix="/users", tags=["Usuários"])
api_router.include_router(accounts_router, prefix="/accounts", tags=["Contas"])
api_router.include_router(categories_router, prefix="/categories", tags=["Categorias"])
api_router.include_router(transactions_router, prefix="/transactions", tags=["Transações"])
api_router.include_router(documents_router, prefix="/documents", tags=["Documentos"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(installments_router, prefix="/installments", tags=["Parcelas"])
api_router.include_router(budgets_router, prefix="/budgets", tags=["Orçamentos"])
api_router.include_router(goals_router, prefix="/goals", tags=["Metas"])
api_router.include_router(debts_router, prefix="/debts", tags=["Dívidas"])
api_router.include_router(recurring_router, prefix="/recurring", tags=["Recorrentes"])
api_router.include_router(family_router, prefix="/family", tags=["Familia"])
api_router.include_router(chat_router, prefix="/chat", tags=["Chat - Agente IA"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin - Gestao"])
api_router.include_router(credit_cards_router, prefix="/credit-cards", tags=["Cartões de Crédito"])
api_router.include_router(income_sources_router, prefix="/income-sources", tags=["Fontes de Receita"])
