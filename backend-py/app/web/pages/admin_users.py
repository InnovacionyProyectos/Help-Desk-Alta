"""Pantalla de administración de Usuarios. Protegida con
require_role('ADMIN') en todas las rutas, igual que el @Roles('ADMIN') de
clase del UsersController original.

El sistema original SOLO tiene esta pantalla de administración: no hay
pantalla de Áreas (se gestionan por API/BD directo) ni de Roles (los 3
roles son fijos) — ver instrucciones de la Fase 8. Áreas y roles solo
aparecen como <select> de solo lectura dentro del formulario de usuario."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSessionType

from app.database import get_db
from app.models.area import Area
from app.models.role import Role
from app.models.user import User
from app.schemas.user import CreateUserDto, UpdateUserDto
from app.security.deps import require_role
from app.services import user_service
from app.services.user_exceptions import DuplicateEmailError, RoleNotFoundError, UserNotFoundError
from app.templating import templates

router = APIRouter()

DbSession = Annotated[DbSessionType, Depends(get_db)]
Admin = Annotated[User, Depends(require_role("ADMIN"))]


def _nav_ctx(user: User, **extra) -> dict:
    return {"current_user": user, "active_nav": "users", **extra}


async def _roles_and_areas(db: DbSession) -> tuple[list[Role], list[Area]]:
    roles_result = await db.execute(select(Role).where(Role.is_active.is_(True)).order_by(Role.id))
    areas_result = await db.execute(select(Area).where(Area.is_active.is_(True)).order_by(Area.name))
    return list(roles_result.scalars().all()), list(areas_result.scalars().all())


# ===================================================================
# Listado
# ===================================================================


@router.get("/admin/users")
async def index(request: Request, user: Admin, db: DbSession):
    users = await user_service.list_users(db)
    return templates.TemplateResponse(
        request,
        "admin/users/index.html",
        _nav_ctx(user, users=users),
    )


# ===================================================================
# Crear
# ===================================================================


@router.get("/admin/users/new")
async def new_form(request: Request, user: Admin, db: DbSession):
    roles, areas = await _roles_and_areas(db)
    return templates.TemplateResponse(
        request,
        "admin/users/form.html",
        _nav_ctx(user, is_edit=False, target=None, roles=roles, areas=areas, error=None),
    )


@router.post("/admin/users/new")
async def create_submit(
    request: Request,
    user: Admin,
    db: DbSession,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    first_name: Annotated[str, Form()],
    last_name: Annotated[str, Form()],
    phone: Annotated[str, Form()] = "",
    role_code: Annotated[str, Form()] = "",
    area_id: Annotated[str, Form()] = "",
):
    dto = CreateUserDto(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        phone=phone or None,
        role_code=role_code,
        area_id=int(area_id) if area_id else None,
    )
    try:
        await user_service.create_user(db, dto, created_by=user)
    except (DuplicateEmailError, RoleNotFoundError) as exc:
        roles, areas = await _roles_and_areas(db)
        return templates.TemplateResponse(
            request,
            "admin/users/form.html",
            _nav_ctx(
                user,
                is_edit=False,
                target=None,
                roles=roles,
                areas=areas,
                error=str(exc),
                form_values=dto,
            ),
            status_code=409 if isinstance(exc, DuplicateEmailError) else 400,
        )
    return RedirectResponse(url="/admin/users", status_code=303)


# ===================================================================
# Editar (sin email ni password — ver schemas/user.py)
# ===================================================================


@router.get("/admin/users/{user_id}/edit")
async def edit_form(user_id: uuid.UUID, request: Request, user: Admin, db: DbSession):
    try:
        target = await user_service.get_one(db, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    roles, areas = await _roles_and_areas(db)
    return templates.TemplateResponse(
        request,
        "admin/users/form.html",
        _nav_ctx(user, is_edit=True, target=target, roles=roles, areas=areas, error=None),
    )


@router.post("/admin/users/{user_id}/edit")
async def update_submit(
    user_id: uuid.UUID,
    request: Request,
    user: Admin,
    db: DbSession,
    first_name: Annotated[str, Form()],
    last_name: Annotated[str, Form()],
    phone: Annotated[str, Form()] = "",
    role_code: Annotated[str, Form()] = "",
    area_id: Annotated[str, Form()] = "",
    is_active: Annotated[str, Form()] = "",
):
    dto = UpdateUserDto(
        first_name=first_name,
        last_name=last_name,
        phone=phone or None,
        role_code=role_code or None,
        area_id=int(area_id) if area_id else None,
        is_active=is_active == "on",
    )
    try:
        await user_service.update_user(db, user_id, dto, updated_by=user)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RoleNotFoundError as exc:
        target = await user_service.get_one(db, user_id)
        roles, areas = await _roles_and_areas(db)
        return templates.TemplateResponse(
            request,
            "admin/users/form.html",
            _nav_ctx(user, is_edit=True, target=target, roles=roles, areas=areas, error=str(exc)),
            status_code=400,
        )
    return RedirectResponse(url="/admin/users", status_code=303)


# ===================================================================
# Acciones HTMX por fila (activar/desactivar, desbloquear)
# ===================================================================


@router.post("/admin/users/{user_id}/toggle-active")
async def toggle_active_action(user_id: uuid.UUID, request: Request, user: Admin, db: DbSession):
    try:
        target = await user_service.toggle_active(db, user_id, actor=user)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(request, "admin/users/_row.html", {"target": target})


@router.post("/admin/users/{user_id}/unlock")
async def unlock_action(user_id: uuid.UUID, request: Request, user: Admin, db: DbSession):
    try:
        target = await user_service.unlock_user(db, user_id, actor=user)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(request, "admin/users/_row.html", {"target": target})
