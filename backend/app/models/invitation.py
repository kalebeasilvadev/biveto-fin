from datetime import datetime, timedelta
from enum import Enum
import secrets
from sqlalchemy import String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


def generate_invitation_token() -> str:
    """Gera token seguro para convite"""
    return secrets.token_urlsafe(32)


def default_expires_at() -> datetime:
    """Expira em 48 horas"""
    return datetime.utcnow() + timedelta(hours=48)


class InvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=generate_invitation_token
    )
    license_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("licenses.id"), nullable=True
    )
    invited_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[InvitationStatus] = mapped_column(
        String(20), default=InvitationStatus.PENDING
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, default=default_expires_at)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    license: Mapped["License"] = relationship(lazy="selectin")
    invited_by: Mapped["User"] = relationship(back_populates="invitations_sent", lazy="selectin")

    @property
    def is_valid(self) -> bool:
        """Verifica se o convite ainda é válido"""
        if self.status != InvitationStatus.PENDING:
            return False
        if datetime.utcnow() > self.expires_at:
            return False
        return True


from .license import License
from .user import User
