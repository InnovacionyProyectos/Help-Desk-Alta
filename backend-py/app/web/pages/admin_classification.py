"""Pantalla de administración del árbol Categoría -> Subcategoría ->
Tipificación. Protegida con require_role('ADMIN'). El árbol se renderiza
completo (incluye inactivos) y cada acción de activar/desactivar es un POST
HTMX que devuelve solo el fragmento `.tree-node` de ese nivel, no todo el
árbol."""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.database import get_db
from app.models.user import User
from app.security.deps import require_role
from app.services import classification_service
from app.services.classification_exceptions import (
    CategoryNotFoundError,
    SubcategoryNotFoundError,
    TypificationNotFoundError,
)
from app.templating import templates

router = APIRouter()

Db = Annotated[DbSession, Depends(get_db)]
Admin = Annotated[User, Depends(require_role("ADMIN"))]


def _nav_ctx(user: User, **extra) -> dict:
    return {"current_user": user, "active_nav": "classification", **extra}


# ===================================================================
# Página principal
# ===================================================================


@router.get("/admin/classification")
async def index(request: Request, user: Admin, db: Db):
    categories = await classification_service.get_admin_tree(db)
    return templates.TemplateResponse(
        request,
        "admin/classification/index.html",
        _nav_ctx(user, categories=categories),
    )


# ===================================================================
# Categorías
# ===================================================================


@router.get("/admin/classification/categories/new")
async def new_category_form(request: Request, user: Admin):
    return templates.TemplateResponse(
        request,
        "admin/classification/category_form.html",
        _nav_ctx(user, mode="create", category=None),
    )


@router.post("/admin/classification/categories")
async def create_category_submit(
    user: Admin,
    db: Db,
    name: Annotated[str, Form()],
    code: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    display_order: Annotated[int, Form()] = 0,
):
    await classification_service.create_category(
        db,
        name=name,
        code=code or None,
        description=description or None,
        display_order=display_order,
    )
    return RedirectResponse(url="/admin/classification", status_code=303)


@router.get("/admin/classification/categories/{category_id}/edit")
async def edit_category_form(category_id: int, request: Request, user: Admin, db: Db):
    try:
        category = await classification_service.get_category_or_fail(db, category_id)
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request,
        "admin/classification/category_form.html",
        _nav_ctx(user, mode="edit", category=category),
    )


@router.post("/admin/classification/categories/{category_id}")
async def update_category_submit(
    category_id: int,
    user: Admin,
    db: Db,
    name: Annotated[str, Form()],
    code: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    display_order: Annotated[int, Form()] = 0,
):
    try:
        await classification_service.update_category(
            db,
            category_id,
            name=name,
            code=code or None,
            description=description or None,
            display_order=display_order,
        )
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RedirectResponse(url="/admin/classification", status_code=303)


@router.post("/admin/classification/categories/{category_id}/toggle-active")
async def toggle_category_active(category_id: int, request: Request, user: Admin, db: Db):
    try:
        category = await classification_service.toggle_category_active(db, category_id)
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(request, "admin/classification/_category_node.html", {"category": category})


# ===================================================================
# Subcategorías
# ===================================================================


@router.get("/admin/classification/categories/{category_id}/subcategories/new")
async def new_subcategory_form(category_id: int, request: Request, user: Admin, db: Db):
    try:
        category = await classification_service.get_category_or_fail(db, category_id)
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request,
        "admin/classification/subcategory_form.html",
        _nav_ctx(user, mode="create", category=category, subcategory=None),
    )


@router.post("/admin/classification/categories/{category_id}/subcategories")
async def create_subcategory_submit(
    category_id: int,
    user: Admin,
    db: Db,
    name: Annotated[str, Form()],
    code: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    display_order: Annotated[int, Form()] = 0,
):
    try:
        await classification_service.create_subcategory(
            db,
            category_id=category_id,
            name=name,
            code=code or None,
            description=description or None,
            display_order=display_order,
        )
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RedirectResponse(url="/admin/classification", status_code=303)


@router.get("/admin/classification/subcategories/{subcategory_id}/edit")
async def edit_subcategory_form(subcategory_id: int, request: Request, user: Admin, db: Db):
    try:
        subcategory = await classification_service.get_subcategory_or_fail(db, subcategory_id)
    except SubcategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request,
        "admin/classification/subcategory_form.html",
        _nav_ctx(user, mode="edit", category=subcategory.category, subcategory=subcategory),
    )


@router.post("/admin/classification/subcategories/{subcategory_id}")
async def update_subcategory_submit(
    subcategory_id: int,
    user: Admin,
    db: Db,
    name: Annotated[str, Form()],
    code: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    display_order: Annotated[int, Form()] = 0,
):
    try:
        await classification_service.update_subcategory(
            db,
            subcategory_id,
            name=name,
            code=code or None,
            description=description or None,
            display_order=display_order,
        )
    except SubcategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RedirectResponse(url="/admin/classification", status_code=303)


@router.post("/admin/classification/subcategories/{subcategory_id}/toggle-active")
async def toggle_subcategory_active(subcategory_id: int, request: Request, user: Admin, db: Db):
    try:
        subcategory = await classification_service.toggle_subcategory_active(db, subcategory_id)
    except SubcategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request, "admin/classification/_subcategory_node.html", {"subcategory": subcategory}
    )


# ===================================================================
# Tipificaciones
# ===================================================================


@router.get("/admin/classification/subcategories/{subcategory_id}/typifications/new")
async def new_typification_form(subcategory_id: int, request: Request, user: Admin, db: Db):
    try:
        subcategory = await classification_service.get_subcategory_or_fail(db, subcategory_id)
    except SubcategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request,
        "admin/classification/typification_form.html",
        _nav_ctx(user, mode="create", subcategory=subcategory, typification=None),
    )


@router.post("/admin/classification/subcategories/{subcategory_id}/typifications")
async def create_typification_submit(
    subcategory_id: int,
    user: Admin,
    db: Db,
    name: Annotated[str, Form()],
    code: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    display_order: Annotated[int, Form()] = 0,
    default_priority: Annotated[str, Form()] = "MEDIUM",
):
    try:
        await classification_service.create_typification(
            db,
            subcategory_id=subcategory_id,
            name=name,
            code=code or None,
            description=description or None,
            display_order=display_order,
            default_priority=default_priority,
        )
    except SubcategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RedirectResponse(url="/admin/classification", status_code=303)


@router.get("/admin/classification/typifications/{typification_id}/edit")
async def edit_typification_form(typification_id: int, request: Request, user: Admin, db: Db):
    try:
        typification = await classification_service.get_typification_or_fail(db, typification_id)
    except TypificationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request,
        "admin/classification/typification_form.html",
        _nav_ctx(user, mode="edit", subcategory=typification.subcategory, typification=typification),
    )


@router.post("/admin/classification/typifications/{typification_id}")
async def update_typification_submit(
    typification_id: int,
    user: Admin,
    db: Db,
    name: Annotated[str, Form()],
    code: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    display_order: Annotated[int, Form()] = 0,
    default_priority: Annotated[str, Form()] = "MEDIUM",
):
    try:
        await classification_service.update_typification(
            db,
            typification_id,
            name=name,
            code=code or None,
            description=description or None,
            display_order=display_order,
            default_priority=default_priority,
        )
    except TypificationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RedirectResponse(url="/admin/classification", status_code=303)


@router.post("/admin/classification/typifications/{typification_id}/toggle-active")
async def toggle_typification_active(typification_id: int, request: Request, user: Admin, db: Db):
    try:
        typification = await classification_service.toggle_typification_active(db, typification_id)
    except TypificationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request, "admin/classification/_typification_node.html", {"typification": typification}
    )
