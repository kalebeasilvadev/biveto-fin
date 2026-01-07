from datetime import datetime, date
from enum import Enum
from sqlalchemy import String, ForeignKey, DateTime, Date, Text, Numeric, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


class TransactionType(str, Enum):
    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"


class RecurrenceType(str, Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), index=True)
    merchant_id: Mapped[int | None] = mapped_column(ForeignKey("merchants.id"))
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"))

    type: Mapped[str] = mapped_column(String(10))  # TransactionType
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="BRL")
    date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    # Recorrência
    is_recurring: Mapped[bool] = mapped_column(default=False)
    recurrence_type: Mapped[str | None] = mapped_column(String(10))
    recurrence_parent_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"))
    recurring_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_transactions.id", ondelete="SET NULL"), index=True
    )

    # Parcelas
    installment_series_id: Mapped[int | None] = mapped_column(
        ForeignKey("installment_series.id", ondelete="SET NULL"), index=True
    )
    installment_number: Mapped[int | None] = mapped_column()  # Parcela atual (ex: 3)
    installment_total: Mapped[int | None] = mapped_column()   # Total de parcelas (ex: 12)
    is_paid: Mapped[bool] = mapped_column(default=True)       # Se a parcela foi paga

    # Tags (lista de strings)
    tags: Mapped[list | None] = mapped_column(JSON)

    # Metadados
    is_fixed: Mapped[bool] = mapped_column(default=False)  # gasto fixo vs variável
    ownership_type: Mapped[str] = mapped_column(String(20), default="personal")  # personal, household
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="transactions")
    account: Mapped["Account"] = relationship(back_populates="transactions", lazy="selectin")
    category: Mapped["Category | None"] = relationship(back_populates="transactions", lazy="selectin")
    merchant: Mapped["Merchant | None"] = relationship(back_populates="transactions", lazy="selectin")
    document: Mapped["Document | None"] = relationship(back_populates="transaction")
    installment_series: Mapped["InstallmentSeries | None"] = relationship(
        back_populates="transactions"
    )
    recurring_source: Mapped["RecurringTransaction | None"] = relationship(
        back_populates="generated_transactions",
        foreign_keys=[recurring_id]
    )
    audit_logs: Mapped[list["TransactionAudit"]] = relationship(
        back_populates="transaction", lazy="selectin"
    )

    # Computed properties for API responses
    @property
    def category_name(self) -> str | None:
        return self.category.name if self.category else None

    @property
    def account_name(self) -> str | None:
        return self.account.name if self.account else None

    @property
    def merchant_name(self) -> str | None:
        return self.merchant.name if self.merchant else None


class TransactionAudit(Base):
    """Log de alterações para auditoria"""
    __tablename__ = "transaction_audit"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), index=True
    )
    field_name: Mapped[str] = mapped_column(String(50))
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(String(50))  # manual, ocr_correction, rule
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    transaction: Mapped["Transaction"] = relationship(back_populates="audit_logs")


from .user import User
from .account import Account
from .category import Category
from .merchant import Merchant
from .document import Document
from .installment import InstallmentSeries
from .recurring import RecurringTransaction
