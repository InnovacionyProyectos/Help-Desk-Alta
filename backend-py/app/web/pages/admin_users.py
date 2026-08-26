"""Pantalla de administración de Usuarios. El NestJS original protegía
todo el controller con @Roles('ADMIN') a nivel de clase; por pedido
explícito del usuario, Técnico ahora tiene los mismos permisos que Admin
en TODA la aplicación excepto Clasificación — incluyendo Usuarios, con
una única excepción: un Técnico no puede eliminar una cuenta con rol
Admin (ver CannotDeleteAdminError en user_service.soft_delete()). Admin
sí puede eliminar cuentas Admin (salvo la propia).

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
from app.schemas.user import ChangePasswordDto, CreateUserDto, UpdateUserDto
from app.security.deps import require_role
from app.services import user_service
from app.services.user_exceptions import (
    CannotDeleteAdminError,
    CannotDeleteSelfError,
    DuplicateEmailError,
    RoleNotFoundError,
    UserNotFoundError,
)
from app.templating import templates

router = APIRouter()

DbSession = Annotated[DbSessionType, Depends(get_db)]
StaffOnly = Annotated[User, Depends(require_role("ADMIN", "TECHNICIAN"))]


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
async def index(request: Request, user: StaffOnly, db: DbSession):
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
async def new_form(request: Request, user: StaffOnly, db: DbSession):
    roles, areas = await _roles_and_areas(db)
    return templates.TemplateResponse(
        request,
        "admin/users/form.html",
        _nav_ctx(user, is_edit=False, target=None, roles=roles, areas=areas, error=None),
    )


@router.post("/admin/users/new")
async def create_submit(
    request: Request,
    user: StaffOnly,
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
async def edit_form(user_id: uuid.UUID, request: Request, user: StaffOnly, db: DbSession):
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
    user: StaffOnly,
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
async def toggle_active_action(user_id: uuid.UUID, request: Request, user: StaffOnly, db: DbSession):
    try:
        target = await user_service.toggle_active(db, user_id, actor=user)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(request, "admin/users/_row.html", {"target": target, "current_user": user})


@router.post("/admin/users/{user_id}/unlock")
async def unlock_action(user_id: uuid.UUID, request: Request, user: StaffOnly, db: DbSession):
    try:
        target = await user_service.unlock_user(db, user_id, actor=user)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(request, "admin/users/_row.html", {"target": target, "current_user": user})


# ===================================================================
# Eliminar (borrado logico) — un Admin no puede eliminarse a si mismo
# ===================================================================


@router.post("/admin/users/{user_id}/delete")
async def delete_action(user_id: uuid.UUID, request: Request, user: StaffOnly, db: DbSession):
    try:
        await user_service.soft_delete(db, user_id, actor=user)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CannotDeleteSelfError as exc:
        # Mismo patron de la Fase 5 (attachments): raise directo, sin
        # fragmento de error inline — el boton usa hx-swap="delete", que
        # solo actua sobre una respuesta 2xx, asi que la fila del propio
        # Admin simplemente no desaparece si esto se dispara.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CannotDeleteAdminError as exc:
        # Un Tecnico no puede eliminar una cuenta Admin — mismo patron
        # 4xx + fila que no desaparece que CannotDeleteSelfError arriba.
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    # hx-swap="delete" en el boton solo necesita un 2xx: ignora el cuerpo
    # y elimina la fila objetivo directamente en el cliente.
    return ""


# ===================================================================
# Cambiar contraseña — accion separada del formulario de editar datos
# ===================================================================


@router.get("/admin/users/{user_id}/password")
async def password_form(user_id: uuid.UUID, request: Request, user: StaffOnly, db: DbSession):
    try:
        target = await user_service.get_one(db, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request,
        "admin/users/password_form.html",
        _nav_ctx(user, target=target, error=None),
    )


@router.post("/admin/users/{user_id}/password")
async def password_submit(
    user_id: uuid.UUID,
    request: Request,
    user: StaffOnly,
    db: DbSession,
    password: Annotated[str, Form()],
):
    # dto = ChangePasswordDto(password=password) puede lanzar
    # pydantic.ValidationError si no llega a 8 caracteres (bypass del
    # minlength del navegador) — se deja propagar al manejador generico
    # de excepciones no capturadas de main.py, mismo patron ya establecido
    # en create_submit() de este mismo archivo (tampoco atrapa el
    # ValidationError de CreateUserDto ahi).
    dto = ChangePasswordDto(password=password)
    try:
        await user_service.change_password(db, user_id, dto, actor=user)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return RedirectResponse(url="/admin/users", status_code=303)
