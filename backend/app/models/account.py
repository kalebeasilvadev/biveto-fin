from datetime import datetime
from enum import Enum
from sqlalchemy import String, ForeignKey, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


class AccountType(str, Enum):
    WALLET = "wallet"
    BANK = "bank"
    CREDIT_CARD = "credit_card"
    INVESTMENT = "investment"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20))  # AccountType
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="BRL")
    color: Mapped[str | None] = mapped_column(String(7))  # hex color
    icon: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(default=True)
    ownership_type: Mapped[str] = mapped_column(String(20), default="personal")  # personal, household
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships - use noload to avoid N+1 queries
    user: Mapped["User"] = relationship(back_populates="accounts")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account", lazy="noload")
    installment_series: Mapped[list["InstallmentSeries"]] = relationship(
        back_populates="account", lazy="noload"
    )
    credit_card_details: Mapped["CreditCard | None"] = relationship(
        back_populates="account", uselist=False, lazy="noload"
    )
    income_sources: Mapped[list["IncomeSource"]] = relationship(
        back_populates="account", lazy="noload"
    )


from .user import User
from .transaction import Transaction
from .installment import InstallmentSeries
from .credit_card import CreditCard
from .income_source import IncomeSource
