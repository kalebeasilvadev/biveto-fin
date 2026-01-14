"""
Schemas do modulo auth.
Exporta os schemas de autenticacao, usuario e convites.
"""
from app.modules.auth.schemas.auth import (
    LoginRequest,
    Token,
    TokenPayload,
)
from app.modules.auth.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserResponse,
    ChangePassword,
)
from app.modules.auth.schemas.invitation import (
    InvitationCreate,
    InvitationResponse,
    InvitationListResponse,
    InviteValidation,
    InviteRegister,
)

__all__ = [
    # Auth schemas
    "LoginRequest",
    "Token",
    "TokenPayload",
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "ChangePassword",
    # Invitation schemas
    "InvitationCreate",
    "InvitationResponse",
    "InvitationListResponse",
    "InviteValidation",
    "InviteRegister",
]
