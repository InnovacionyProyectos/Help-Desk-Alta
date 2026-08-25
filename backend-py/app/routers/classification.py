"""Endpoints JSON de clasificación, disponibles para cualquier usuario
autenticado (el Usuario Final los necesita para poblar la cascada de
Categoría/Subcategoría/Tipificación al crear un ticket)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.database import get_db
from app.schemas.classification import CategoryOption, SubcategoryItem, TypificationItem
from app.security.deps import CurrentUser
from app.services import classification_service
from app.services.classification_exceptions import CategoryNotFoundError, SubcategoryNotFoundError

router = APIRouter(prefix="/api/classification", tags=["classification"])

Db = Annotated[DbSession, Depends(get_db)]


@router.get("/cascade", response_model=list[CategoryOption])
async def cascade(db: Db, user: CurrentUser):
    return await classification_service.get_cascade(db)


@router.get("/categories/{category_id}/subcategories", response_model=list[SubcategoryItem])
async def subcategories(category_id: int, db: Db, user: CurrentUser):
    try:
        return await classification_service.get_subcategories_by_category(db, category_id)
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/subcategories/{subcategory_id}/typifications", response_model=list[TypificationItem])
async def typifications(subcategory_id: int, db: Db, user: CurrentUser):
    try:
        return await classification_service.get_typifications_by_subcategory(db, subcategory_id)
    except SubcategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
