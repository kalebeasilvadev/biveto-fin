from fastapi import APIRouter

from ..core.deps import CurrentUser, DbSession
from ..schemas.user import UserResponse, UserUpdate
from ..services.user_service import UserService

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: CurrentUser):
    """Retorna dados do usuário autenticado"""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    data: UserUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza dados do usuário autenticado"""
    user_service = UserService(db)
    return await user_service.update(current_user, data)
