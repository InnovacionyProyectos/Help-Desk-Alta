"""Equivalente a users.service.ts del backend NestJS original. Mismo
patrón que classification_service.py/ticket_service.py: funciones puras
que reciben `db: AsyncSession` explícito, sin repositorios inyectados."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession
from sqlalchemy.orm import selectinload

from app.models.role import Role
from app.models.user import User
from app.schemas.user import ChangePasswordDto, CreateUserDto, SelfChangePasswordDto, UpdateUserDto
from app.security.passwords import hash_password, verify_password
from app.services import audit_service
from app.services.user_exceptions import (
    CannotDeleteAdminError,
    CannotDeleteSelfError,
    DuplicateEmailError,
    IncorrectCurrentPasswordError,
    RoleNotFoundError,
    UserNotFoundError,
)

_LOAD_OPTS = (selectinload(User.role), selectinload(User.area))


async def _get_role_by_code(db: DbSession, role_code: str) -> Role:
    result = await db.execute(select(Role).where(Role.code == role_code))
    role = result.scalar_one_or_none()
    if role is None:
        raise RoleNotFoundError(role_code)
    return role


async def list_users(db: DbSession) -> list[User]:
    """Excluye borrados lógicos (`deleted_at IS NOT NULL`), como
    `findAll()` del original. Ordenado por nombre para que la tabla admin
    sea navegable — el original no ordena, es una decisión de UI propia
    de esta fase, no una regla de negocio."""
    result = await db.execute(
        select(User)
        .where(User.deleted_at.is_(None))
        .options(*_LOAD_OPTS)
        .order_by(User.first_name, User.last_name)
    )
    return list(result.scalars().all())


async def get_one(db: DbSession, user_id: uuid.UUID) -> User:
    # populate_existing=True: mismo choque de identity-map documentado en
    # ticket_service.get_one() — sin esto, un re-fetch tras mutar un User
    # ya cargado en esta sesión (expire_on_commit=False) devolvería el
    # objeto Python obsoleto en vez de reflejar el commit recién hecho.
    result = await db.execute(
        select(User)
        .where(User.id == user_id, User.deleted_at.is_(None))
        .options(*_LOAD_OPTS)
        .execution_options(populate_existing=True)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise UserNotFoundError(user_id)
    return user


async def create_user(db: DbSession, dto: CreateUserDto, *, created_by: User) -> User:
    """Verifica el correo duplicado con un SELECT previo (igual que
    `usersRepo.findOne({where: {email}})` del `UsersService.create()`
    original) en vez de insertar y capturar el `IntegrityError` de la
    restricción UNIQUE: `Session.rollback()` expira TODOS los objetos ya
    cargados en esta misma sesión de request — incluido `current_user`,
    que `layout/base.html` necesita para el sidebar — y el siguiente
    acceso a `current_user.role` dispara una carga diferida síncrona en
    pleno render de Jinja2 (`MissingGreenlet`), confirmado en vivo al
    construir esta fase. El SELECT previo es exactamente lo que ya hacía
    el original (con la misma ventana de carrera teórica, aceptable para
    un módulo admin-only de baja concurrencia) y evita el problema de raíz."""
    existing = await db.execute(select(User).where(User.email == dto.email, User.deleted_at.is_(None)))
    if existing.scalar_one_or_none() is not None:
        raise DuplicateEmailError()

    role = await _get_role_by_code(db, dto.role_code)

    user = User(
        email=dto.email,
        password_hash=hash_password(dto.password),
        first_name=dto.first_name,
        last_name=dto.last_name,
        phone=dto.phone,
        role_id=role.id,
        area_id=dto.area_id,
    )
    db.add(user)
    await db.flush()

    await audit_service.record(
        db,
        user_id=created_by.id,
        action="CREATE",
        entity="User",
        entity_id=str(user.id),
        new_values={
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "roleCode": dto.role_code,
        },
    )
    await db.commit()
    return await get_one(db, user.id)


async def update_user(db: DbSession, user_id: uuid.UUID, dto: UpdateUserDto, *, updated_by: User) -> User:
    """No admite email ni password (ver schemas/user.py) — replica la
    limitación del formulario de edición original, que ni siquiera envía
    esos campos."""
    user = await get_one(db, user_id)

    old_values = {
        "firstName": user.first_name,
        "lastName": user.last_name,
        "phone": user.phone,
        "roleCode": user.role.code,
        "areaId": user.area_id,
        "isActive": user.is_active,
    }

    if dto.role_code is not None:
        role = await _get_role_by_code(db, dto.role_code)
        user.role_id = role.id
    if dto.first_name is not None:
        user.first_name = dto.first_name
    if dto.last_name is not None:
        user.last_name = dto.last_name
    if dto.phone is not None:
        user.phone = dto.phone
    if dto.area_id is not None:
        user.area_id = dto.area_id
    if dto.is_active is not None:
        user.is_active = dto.is_active

    await audit_service.record(
        db,
        user_id=updated_by.id,
        action="UPDATE",
        entity="User",
        entity_id=str(user_id),
        old_values=old_values,
        new_values={
            "firstName": user.first_name,
            "lastName": user.last_name,
            "phone": user.phone,
            "roleCode": dto.role_code or old_values["roleCode"],
            "areaId": user.area_id,
            "isActive": user.is_active,
        },
    )
    await db.commit()
    return await get_one(db, user_id)


async def toggle_active(db: DbSession, user_id: uuid.UUID, *, actor: User) -> User:
    user = await get_one(db, user_id)
    was_active = user.is_active
    user.is_active = not user.is_active

    await audit_service.record(
        db,
        user_id=actor.id,
        action="UPDATE",
        entity="User",
        entity_id=str(user_id),
        old_values={"isActive": was_active},
        new_values={"isActive": user.is_active},
    )
    await db.commit()
    return await get_one(db, user_id)


async def unlock_user(db: DbSession, user_id: uuid.UUID, *, actor: User) -> User:
    """Limpia un bloqueo por intentos fallidos (auth_service.login bloquea
    tras 5 intentos por 15 min); el Admin puede liberar la cuenta antes de
    que expire por sí sola."""
    user = await get_one(db, user_id)
    user.locked_until = None
    user.failed_login_attempts = 0

    await audit_service.record(
        db,
        user_id=actor.id,
        action="UPDATE",
        entity="User",
        entity_id=str(user_id),
        new_values={"lockedUntil": None, "failedLoginAttempts": 0},
    )
    await db.commit()
    return await get_one(db, user_id)


async def change_password(db: DbSession, user_id: uuid.UUID, dto: ChangePasswordDto, *, actor: User) -> User:
    """Acción Admin-only, deliberadamente separada de update_user() (form
    aparte, ver instrucciones) — nunca se registra la contraseña en claro
    ni el hash en la auditoría, solo un booleano. Resetea
    must_change_password=True por consistencia con el resto del sistema
    (hoy no hay pantalla que fuerce ese cambio en el primer login — misma
    limitación conocida que ya existía para altas nuevas, documentada en
    memoria)."""
    user = await get_one(db, user_id)
    user.password_hash = hash_password(dto.password)
    user.must_change_password = True

    await audit_service.record(
        db,
        user_id=actor.id,
        action="UPDATE",
        entity="User",
        entity_id=str(user_id),
        new_values={"password_changed": True},
    )
    await db.commit()
    return await get_one(db, user_id)


async def change_own_password(db: DbSession, user: User, dto: SelfChangePasswordDto) -> None:
    """Panel de perfil (mejora post-corte, pedida explícitamente): a
    diferencia de `change_password()` (Admin-only, sin verificar la clave
    actual), aquí el propio usuario cambia su contraseña y SÍ debe probar
    que conoce la actual — si no, cualquiera con una sesión abierta sin
    vigilancia podría secuestrar la cuenta cambiándole la clave. Al ser el
    propio dueño quien la elige, `must_change_password` queda en False (no
    hace falta forzar otro cambio después, a diferencia del reseteo por
    Admin)."""
    if not verify_password(user.password_hash, dto.current_password):
        raise IncorrectCurrentPasswordError()

    user.password_hash = hash_password(dto.new_password)
    user.must_change_password = False

    await audit_service.record(
        db,
        user_id=user.id,
        action="UPDATE",
        entity="User",
        entity_id=str(user.id),
        new_values={"password_changed": True, "self_service": True},
    )
    await db.commit()


async def soft_delete(db: DbSession, user_id: uuid.UUID, *, actor: User) -> None:
    """Equivalente a `remove()` del UsersController original — portado
    desde la Fase 8 pero sin exponer en ninguna ruta hasta la mejora
    post-Fase-9 que agrega el botón "Eliminar" en /admin/users. Un Admin
    no puede eliminarse a sí mismo (se quedaría sin acceso al panel).

    Técnico tiene, por pedido explícito, los mismos permisos que Admin en
    esta pantalla salvo una única excepción: no puede eliminar una cuenta
    con rol Admin (Admin sí puede eliminar cuentas Admin, salvo la propia)."""
    if actor.id == user_id:
        raise CannotDeleteSelfError()

    user = await get_one(db, user_id)

    if actor.role.code == "TECHNICIAN" and user.role.code == "ADMIN":
        raise CannotDeleteAdminError()

    old_email = user.email
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False

    await audit_service.record(
        db,
        user_id=actor.id,
        action="DELETE",
        entity="User",
        entity_id=str(user_id),
        old_values={"email": old_email},
    )
    await db.commit()
