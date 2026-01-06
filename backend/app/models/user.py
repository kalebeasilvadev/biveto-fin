from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    license_id: Mapped[int | None] = mapped_column(ForeignKey("licenses.id"), nullable=True)
    reset_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # License relationship
    license: Mapped["License | None"] = relationship(back_populates="users", lazy="selectin")

    # Relationships - cascade delete when user is deleted
    accounts: Mapped[list["Account"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    merchant_rules: Mapped[list["UserMerchantRule"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    installment_series: Mapped[list["InstallmentSeries"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    budgets: Mapped[list["Budget"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    goals: Mapped[list["Goal"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    debts: Mapped[list["Debt"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    invitations_sent: Mapped[list["Invitation"]] = relationship(
        back_populates="invited_by", lazy="selectin", cascade="all, delete-orphan"
    )
    recurring_transactions: Mapped[list["RecurringTransaction"]] = relationship(
        back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )


from .account import Account
from .transaction import Transaction
from .document import Document
from .rule import UserMerchantRule
from .installment import InstallmentSeries
from .budget import Budget
from .goal import Goal
from .debt import Debt
from .license import License
from .invitation import Invitation
from .recurring import RecurringTransaction
