import secrets
from datetime import date
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func
from passlib.context import CryptContext

from ..core.deps import CurrentUser, DbSession
from ..models import User, License, LicenseStatus
from ..services.user_setup import setup_new_user
from ..schemas.admin import (
    LicenseCreate,
    LicenseUpdate,
    LicenseResponse,
    UserAdminCreate,
    UserAdminUpdate,
    UserAdminResponse,
    UserListResponse,
    AdminDashboard,
)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def require_admin(user: User):
    """Verifica se o usuário é admin"""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Apenas administradores podem acessar."
        )


# ========== Dashboard ==========

@router.get("/dashboard", response_model=AdminDashboard)
async def get_dashboard(current_user: CurrentUser, db: DbSession):
    """Dashboard com estatísticas gerais"""
    require_admin(current_user)

    # Count users
    total_users = await db.scalar(select(func.count(User.id)))
    active_users = await db.scalar(
        select(func.count(User.id)).where(User.is_active == True)
    )
    admin_users = await db.scalar(
        select(func.count(User.id)).where(User.is_admin == True)
    )

    # Count licenses
    total_licenses = await db.scalar(select(func.count(License.id)))
    active_licenses = await db.scalar(
        select(func.count(License.id)).where(License.status == LicenseStatus.ACTIVE)
    )
    expired_licenses = await db.scalar(
        select(func.count(License.id)).where(License.status == LicenseStatus.EXPIRED)
    )

    return AdminDashboard(
        total_users=total_users or 0,
        active_users=active_users or 0,
        admin_users=admin_users or 0,
        total_licenses=total_licenses or 0,
        active_licenses=active_licenses or 0,
        expired_licenses=expired_licenses or 0,
    )


# ========== Licenses ==========

@router.get("/licenses", response_model=list[LicenseResponse])
async def list_licenses(current_user: CurrentUser, db: DbSession):
    """Lista todas as licenças"""
    require_admin(current_user)

    result = await db.execute(select(License).order_by(License.created_at.desc()))
    licenses = result.scalars().all()

    response = []
    for lic in licenses:
        user_count = await db.scalar(
            select(func.count(User.id)).where(User.license_id == lic.id)
        )
        resp = LicenseResponse(
            id=lic.id,
            key=lic.key,
            type=lic.type,
            status=lic.status,
            max_users=lic.max_users,
            max_transactions_per_month=lic.max_transactions_per_month,
            max_documents_per_month=lic.max_documents_per_month,
            has_ai_assistant=lic.has_ai_assistant,
            has_insights=lic.has_insights,
            has_debt_strategies=lic.has_debt_strategies,
            has_goals=lic.has_goals,
            has_budget=lic.has_budget,
            start_date=lic.start_date,
            end_date=lic.end_date,
            notes=lic.notes,
            created_at=lic.created_at,
            updated_at=lic.updated_at,
            is_valid=lic.is_valid,
            days_remaining=lic.days_remaining,
            user_count=user_count or 0,
        )
        response.append(resp)

    return response


@router.post("/licenses", response_model=LicenseResponse, status_code=status.HTTP_201_CREATED)
async def create_license(
    data: LicenseCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma nova licença"""
    require_admin(current_user)

    # Generate unique key
    key = secrets.token_urlsafe(32)

    license = License(
        key=key,
        type=data.type,
        max_users=data.max_users,
        max_transactions_per_month=data.max_transactions_per_month,
        max_documents_per_month=data.max_documents_per_month,
        has_ai_assistant=data.has_ai_assistant,
        has_insights=data.has_insights,
        has_debt_strategies=data.has_debt_strategies,
        has_goals=data.has_goals,
        has_budget=data.has_budget,
        start_date=data.start_date,
        end_date=data.end_date,
        notes=data.notes,
    )

    db.add(license)
    await db.commit()
    await db.refresh(license)

    return LicenseResponse(
        id=license.id,
        key=license.key,
        type=license.type,
        status=license.status,
        max_users=license.max_users,
        max_transactions_per_month=license.max_transactions_per_month,
        max_documents_per_month=license.max_documents_per_month,
        has_ai_assistant=license.has_ai_assistant,
        has_insights=license.has_insights,
        has_debt_strategies=license.has_debt_strategies,
        has_goals=license.has_goals,
        has_budget=license.has_budget,
        start_date=license.start_date,
        end_date=license.end_date,
        notes=license.notes,
        created_at=license.created_at,
        updated_at=license.updated_at,
        is_valid=license.is_valid,
        days_remaining=license.days_remaining,
        user_count=0,
    )


@router.patch("/licenses/{license_id}", response_model=LicenseResponse)
async def update_license(
    license_id: int,
    data: LicenseUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza uma licença"""
    require_admin(current_user)

    result = await db.execute(select(License).where(License.id == license_id))
    license = result.scalar_one_or_none()

    if not license:
        raise HTTPException(status_code=404, detail="Licença não encontrada")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(license, key, value)

    await db.commit()
    await db.refresh(license)

    user_count = await db.scalar(
        select(func.count(User.id)).where(User.license_id == license.id)
    )

    return LicenseResponse(
        id=license.id,
        key=license.key,
        type=license.type,
        status=license.status,
        max_users=license.max_users,
        max_transactions_per_month=license.max_transactions_per_month,
        max_documents_per_month=license.max_documents_per_month,
        has_ai_assistant=license.has_ai_assistant,
        has_insights=license.has_insights,
        has_debt_strategies=license.has_debt_strategies,
        has_goals=license.has_goals,
        has_budget=license.has_budget,
        start_date=license.start_date,
        end_date=license.end_date,
        notes=license.notes,
        created_at=license.created_at,
        updated_at=license.updated_at,
        is_valid=license.is_valid,
        days_remaining=license.days_remaining,
        user_count=user_count or 0,
    )


@router.delete("/licenses/{license_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_license(
    license_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Deleta uma licença"""
    require_admin(current_user)

    result = await db.execute(select(License).where(License.id == license_id))
    license = result.scalar_one_or_none()

    if not license:
        raise HTTPException(status_code=404, detail="Licença não encontrada")

    # Check if license has users
    user_count = await db.scalar(
        select(func.count(User.id)).where(User.license_id == license.id)
    )
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível deletar. {user_count} usuário(s) vinculado(s)."
        )

    await db.delete(license)
    await db.commit()


# ========== Users ==========

@router.get("/users", response_model=list[UserListResponse])
async def list_users(current_user: CurrentUser, db: DbSession):
    """Lista todos os usuários"""
    require_admin(current_user)

    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    return [UserListResponse.model_validate(u) for u in users]


@router.post("/users", response_model=UserAdminResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserAdminCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria um novo usuário (via admin)"""
    require_admin(current_user)

    # Check if email exists
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    # Validate license if provided
    if data.license_id:
        license = await db.scalar(
            select(License).where(License.id == data.license_id)
        )
        if not license:
            raise HTTPException(status_code=400, detail="Licença não encontrada")

    user = User(
        email=data.email,
        hashed_password=pwd_context.hash(data.password),
        name=data.name,
        is_admin=data.is_admin,
        license_id=data.license_id,
        is_verified=True,  # Admin created users are verified
    )

    db.add(user)
    await db.flush()  # Flush to get user ID
    await db.refresh(user)

    # Create default accounts and categories for the new user
    await setup_new_user(db, user.id)

    await db.commit()

    return UserAdminResponse.model_validate(user)


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user(
    user_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Obtém detalhes de um usuário"""
    require_admin(current_user)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    return UserAdminResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: int,
    data: UserAdminUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza um usuário"""
    require_admin(current_user)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    update_data = data.model_dump(exclude_unset=True)

    # Hash password if being updated
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = pwd_context.hash(update_data.pop("password"))
    elif "password" in update_data:
        del update_data["password"]

    # Check email uniqueness
    if "email" in update_data:
        existing = await db.scalar(
            select(User).where(User.email == update_data["email"], User.id != user_id)
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email já cadastrado")

    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

    return UserAdminResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Deleta um usuário"""
    require_admin(current_user)

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível deletar a si mesmo")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    await db.delete(user)
    await db.commit()
