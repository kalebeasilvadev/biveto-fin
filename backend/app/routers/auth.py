from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import DbSession
from ..schemas.user import UserCreate, UserResponse
from ..schemas.auth import Token, LoginRequest
from ..services.auth_service import AuthService
from ..services.user_service import UserService

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(user_data: UserCreate, db: DbSession):
    """Registra um novo usuário"""
    auth_service = AuthService(db)
    user_service = UserService(db)

    user = await auth_service.register(user_data)
    await user_service.setup_initial_data(user)

    return user


@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest, db: DbSession):
    """Autentica usuário e retorna tokens"""
    auth_service = AuthService(db)
    return await auth_service.login(credentials.email, credentials.password)


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str = Body(..., embed=True), db: DbSession = None):
    """Renova o access token usando refresh token"""
    auth_service = AuthService(db)
    return await auth_service.refresh_token(refresh_token)
