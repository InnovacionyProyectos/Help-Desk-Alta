"""Auditoría, equivalente a AuditService.record() del backend NestJS
original. En vez del interceptor genérico automático (`@Audit(entity)` sobre
cada controller) que no tiene una forma directa de replicarse en FastAPI sin
introducir una arquitectura nueva, esta reescritura llama `record()`
explícitamente desde cada punto de negocio que crea/modifica algo — ver Fase
9 del plan para el listado completo de puntos cubiertos (antes de esa fase
solo change_status/assign de tickets llamaban esto)."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.models.audit import AuditLog

if TYPE_CHECKING:
    from app.models.user import User


async def record(
    db: DbSession,
    *,
    user_id: uuid.UUID | None,
    action: str,
    entity: str,
    entity_id: str,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
        )
    )
    # No hace commit propio: se ejecuta dentro de la misma unidad de trabajo
    # que la operación que audita (ver ticket_service.change_status/assign),
    # para que auditoría y mutación queden atómicas en el mismo commit.


async def record_create(
    db: DbSession,
    actor: "User | None",
    *,
    entity: str,
    entity_id: object,
    new_values: dict[str, Any] | None = None,
) -> None:
    """Azúcar sobre record() para el caso CREATE — `actor=None` sigue
    significando "Sistema" (misma convención ya establecida desde
    Fase 3/4, ej. el job de auto-cierre)."""
    await record(
        db,
        user_id=actor.id if actor is not None else None,
        action="CREATE",
        entity=entity,
        entity_id=str(entity_id),
        new_values=new_values,
    )


async def record_update(
    db: DbSession,
    actor: "User | None",
    *,
    entity: str,
    entity_id: object,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
) -> None:
    """Azúcar sobre record() para el caso UPDATE — ver nota de record_create
    sobre actor=None."""
    await record(
        db,
        user_id=actor.id if actor is not None else None,
        action="UPDATE",
        entity=entity,
        entity_id=str(entity_id),
        old_values=old_values,
        new_values=new_values,
    )
