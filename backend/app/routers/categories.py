from fastapi import APIRouter, HTTPException
from sqlalchemy import select, or_

from ..core.deps import CurrentUser, DbSession
from ..models.category import Category
from ..schemas.category import CategoryCreate, CategoryResponse

router = APIRouter()


@router.get("", response_model=list[CategoryResponse])
async def list_categories(current_user: CurrentUser, db: DbSession):
    """Lista todas as categorias (do sistema + do usuário)"""
    result = await db.execute(
        select(Category).where(
            or_(
                Category.is_system == True,
                Category.user_id == current_user.id,
            )
        )
    )
    return result.scalars().all()


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma categoria personalizada"""
    category = Category(
        user_id=current_user.id,
        name=data.name,
        type=data.type,
        icon=data.icon,
        color=data.color,
        parent_id=data.parent_id,
        is_system=False,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove uma categoria personalizada (não pode remover categorias do sistema)"""
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.user_id == current_user.id,
            Category.is_system == False,
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=404,
            detail="Categoria não encontrada ou é uma categoria do sistema",
        )

    await db.delete(category)
