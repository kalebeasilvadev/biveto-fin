"""
Serviço para configuração inicial de novos usuários.
Cria contas e categorias padrão.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.account import Account, AccountType
from ..models.category import Category, CategoryType


# Contas padrão para novos usuários
DEFAULT_ACCOUNTS = [
    {
        "name": "Carteira",
        "type": AccountType.WALLET,
        "balance": 0,
        "color": "#22c55e",
        "icon": "wallet",
    },
    {
        "name": "Banco",
        "type": AccountType.BANK,
        "balance": 0,
        "color": "#3b82f6",
        "icon": "building",
    },
]

# Categorias padrão para novos usuários
DEFAULT_CATEGORIES = [
    # Despesas
    {"name": "Alimentação", "type": CategoryType.EXPENSE, "icon": "utensils", "color": "#ef4444"},
    {"name": "Transporte", "type": CategoryType.EXPENSE, "icon": "car", "color": "#f97316"},
    {"name": "Moradia", "type": CategoryType.EXPENSE, "icon": "home", "color": "#eab308"},
    {"name": "Saúde", "type": CategoryType.EXPENSE, "icon": "heart-pulse", "color": "#22c55e"},
    {"name": "Educação", "type": CategoryType.EXPENSE, "icon": "graduation-cap", "color": "#06b6d4"},
    {"name": "Lazer", "type": CategoryType.EXPENSE, "icon": "gamepad-2", "color": "#8b5cf6"},
    {"name": "Vestuário", "type": CategoryType.EXPENSE, "icon": "shirt", "color": "#ec4899"},
    {"name": "Mercado", "type": CategoryType.EXPENSE, "icon": "shopping-cart", "color": "#14b8a6"},
    {"name": "Contas", "type": CategoryType.EXPENSE, "icon": "file-text", "color": "#6366f1"},
    {"name": "Outros", "type": CategoryType.EXPENSE, "icon": "more-horizontal", "color": "#64748b"},
    # Receitas
    {"name": "Salário", "type": CategoryType.INCOME, "icon": "briefcase", "color": "#22c55e"},
    {"name": "Freelance", "type": CategoryType.INCOME, "icon": "laptop", "color": "#3b82f6"},
    {"name": "Investimentos", "type": CategoryType.INCOME, "icon": "trending-up", "color": "#8b5cf6"},
    {"name": "Presente", "type": CategoryType.INCOME, "icon": "gift", "color": "#ec4899"},
    {"name": "Outros", "type": CategoryType.INCOME, "icon": "plus-circle", "color": "#64748b"},
]


async def create_default_accounts(db: AsyncSession, user_id: int) -> list[Account]:
    """Cria contas padrão para um novo usuário."""
    accounts = []
    for acc_data in DEFAULT_ACCOUNTS:
        account = Account(
            user_id=user_id,
            name=acc_data["name"],
            type=acc_data["type"].value,
            balance=acc_data["balance"],
            color=acc_data["color"],
            icon=acc_data["icon"],
        )
        db.add(account)
        accounts.append(account)

    await db.flush()
    return accounts


async def create_default_categories(db: AsyncSession, user_id: int) -> list[Category]:
    """Cria categorias padrão para um novo usuário."""
    categories = []
    for cat_data in DEFAULT_CATEGORIES:
        category = Category(
            user_id=user_id,
            name=cat_data["name"],
            type=cat_data["type"].value,
            icon=cat_data["icon"],
            color=cat_data["color"],
            is_system=True,  # Marca como categoria do sistema
        )
        db.add(category)
        categories.append(category)

    await db.flush()
    return categories


async def setup_new_user(db: AsyncSession, user_id: int) -> dict:
    """
    Configura dados iniciais para um novo usuário.
    Cria contas e categorias padrão.
    """
    accounts = await create_default_accounts(db, user_id)
    categories = await create_default_categories(db, user_id)

    return {
        "accounts_created": len(accounts),
        "categories_created": len(categories),
    }
