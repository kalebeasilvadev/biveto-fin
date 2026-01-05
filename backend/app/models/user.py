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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # License relationship
    license: Mapped["License | None"] = relationship(back_populates="users", lazy="selectin")

    # Relationships
    accounts: Mapped[list["Account"]] = relationship(back_populates="user", lazy="selectin")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user", lazy="selectin")
    documents: Mapped[list["Document"]] = relationship(back_populates="user", lazy="selectin")
    merchant_rules: Mapped[list["UserMerchantRule"]] = relationship(
        back_populates="user", lazy="selectin"
    )
    installment_series: Mapped[list["InstallmentSeries"]] = relationship(
        back_populates="user", lazy="selectin"
    )
    budgets: Mapped[list["Budget"]] = relationship(back_populates="user", lazy="selectin")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user", lazy="selectin")
    debts: Mapped[list["Debt"]] = relationship(back_populates="user", lazy="selectin")


from .account import Account
from .transaction import Transaction
from .document import Document
from .rule import UserMerchantRule
from .installment import InstallmentSeries
from .budget import Budget
from .goal import Goal
from .debt import Debt
from .license import License
