"""
Modelo de Orçamento (Budget) - Sistema de orçamento por categoria
Baseado nas metodologias YNAB e Dave Ramsey
"""
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlalchemy import String, ForeignKey, DateTime, Numeric, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


class BudgetPeriodType(str, Enum):
    """Tipo de período do orçamento"""
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    YEARLY = "yearly"


class Budget(Base):
    """
    Orçamento mensal do usuário.
    Cada usuário tem um orçamento por mês que contém limites por categoria.
    """
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)  # 1-12

    # Valores totais planejados
    total_income_planned: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_expense_planned: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    # Configurações
    allow_rollover: Mapped[bool] = mapped_column(Boolean, default=True)  # Permite rolar saldo não usado
    notes: Mapped[str | None] = mapped_column(Text)
    ownership_type: Mapped[str] = mapped_column(String(20), default="personal")  # personal, household

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="budgets")
    items: Mapped[list["BudgetItem"]] = relationship(
        back_populates="budget",
        cascade="all, delete-orphan",
        lazy="noload"
    )


class BudgetItem(Base):
    """
    Item de orçamento por categoria.
    Define o limite planejado para cada categoria no mês.
    """
    __tablename__ = "budget_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)

    # Valores
    planned_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # Valor planejado
    rollover_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)  # Valor do mês anterior

    # Configurações do item
    is_fixed: Mapped[bool] = mapped_column(Boolean, default=False)  # Gasto fixo (aluguel, etc)
    priority: Mapped[int] = mapped_column(Integer, default=0)  # Ordem de prioridade
    notes: Mapped[str | None] = mapped_column(String(200))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    budget: Mapped["Budget"] = relationship(back_populates="items")
    category: Mapped["Category"] = relationship()


# Import para evitar circular import
from .user import User
from .category import Category
