"""Equivalente a tickets.service.ts del backend NestJS original. Todas las
funciones son puras y reciben `db: AsyncSession` explícito (sin repositorios
inyectados), siguiendo el mismo patrón que classification_service.py."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.models.ticket import (
    Ticket,
    TicketAssignmentHistory,
    TicketComment,
    TicketStatus,
    TicketStatusHistory,
)
from app.models.user import User
from app.schemas.ticket import (
    AssignTicketDto,
    ChangeTicketStatusDto,
    CreateCommentDto,
    CreateTicketDto,
    UpdateTicketDto,
)
from app.services import audit_service, classification_service
from app.services.ticket_exceptions import (
    ForbiddenTicketAccessError,
    IncompleteClassificationError,
    InvalidStatusTransitionError,
    TicketClosedError,
    TicketNotFoundError,
)

DEFAULT_PRIORITY = "MEDIUM"
DEFAULT_TICKET_TYPE = "INCIDENTE"


# ===================================================================
# Helpers internos
# ===================================================================


async def _get_status_by_code(db: DbSession, code: str) -> TicketStatus:
    result = await db.execute(select(TicketStatus).where(TicketStatus.code == code))
    return result.scalar_one()


async def _generate_ticket_number(db: DbSession) -> str:
    """`nextval('ticket_number_seq')` — mejora deliberada frente al
    `COUNT(*)` con condición de carrera del NestJS original (ver plan de
    reescritura, sección "Mejora deliberada, no regresión")."""
    result = await db.execute(text("SELECT nextval('ticket_number_seq')"))
    seq = result.scalar_one()
    year = datetime.now().year
    return f"HD-{year}-{str(seq).zfill(5)}"


def _assert_can_access_ticket(ticket: Ticket, actor: User) -> None:
    if actor.role.code == "END_USER" and ticket.requester_id != actor.id:
        raise ForbiddenTicketAccessError()


def _assert_ticket_not_closed(ticket: Ticket) -> None:
    """CLOSED es terminal: una vez cerrado, ningún dato del ticket puede
    cambiar (clasificación, prioridad, tipo, asignación, comentarios),
    sin excepción de rol. change_status() cubre CLOSED por su cuenta con
    una comprobación específica; este helper cubre el resto."""
    if ticket.status.code == "CLOSED":
        raise TicketClosedError()


# ===================================================================
# CRUD
# ===================================================================


async def create_ticket(db: DbSession, dto: CreateTicketDto, requester: User) -> Ticket:
    has_any = dto.category_id or dto.subcategory_id or dto.typification_id
    has_full = dto.category_id and dto.subcategory_id and dto.typification_id
    if has_any and not has_full:
        raise IncompleteClassificationError()

    if has_full:
        # validate_chain() sigue validando que category/subcategory/
        # typification formen una cadena jerárquica válida — solo se dejó
        # de usar su valor de retorno para derivar la prioridad (ver
        # decisión de negocio abajo).
        await classification_service.validate_chain(db, dto.category_id, dto.subcategory_id, dto.typification_id)

    open_status = await _get_status_by_code(db, "OPEN")

    # Decisión de negocio (mejora post-Fase-9): la prioridad ya NO se
    # sugiere/hereda desde `typification.default_priority` — se asigna
    # siempre directo en el ticket (por el solicitante al crear, o por
    # staff después desde _priority_card.html). Antes este bloque leía
    # `typification.default_priority` como segundo fallback; ahora es
    # únicamente dto.priority o MEDIUM.
    priority = dto.priority.value if dto.priority is not None else DEFAULT_PRIORITY

    ticket = Ticket(
        ticket_number=await _generate_ticket_number(db),
        subject=dto.subject,
        description=dto.description,
        category_id=dto.category_id,
        subcategory_id=dto.subcategory_id,
        typification_id=dto.typification_id,
        status_id=open_status.id,
        priority=priority,
        # ticket_type no viene en CreateTicketDto (el DTO original tampoco
        # lo tiene): todo ticket nace INCIDENTE (default de columna) y se
        # cambia despues con update_ticket().
        ticket_type=DEFAULT_TICKET_TYPE,
        requester_id=requester.id,
        # El ticket hereda el area del solicitante una sola vez, al crear;
        # no se recalcula despues aunque el usuario cambie de area.
        assigned_area_id=requester.area_id,
    )
    db.add(ticket)
    # flush necesario antes de leer ticket.id: es un default de Python
    # (default=uuid.uuid4 en el modelo, ver app/models/ticket.py), y
    # SQLAlchemy solo lo materializa en el objeto al hacer flush/commit, no
    # al construir la instancia — sin este flush, ticket.id sigue siendo
    # None en este punto y quedaría un audit_logs.entity_id nulo (bug real
    # encontrado durante la verificación de esta fase).
    await db.flush()
    await audit_service.record_create(
        db,
        requester,
        entity="Ticket",
        entity_id=ticket.id,
        new_values={
            "ticketNumber": ticket.ticket_number,
            "subject": ticket.subject,
            "priority": ticket.priority,
            "ticketType": ticket.ticket_type,
            "categoryId": ticket.category_id,
            "subcategoryId": ticket.subcategory_id,
            "typificationId": ticket.typification_id,
        },
    )
    await db.commit()
    return await get_one(db, ticket.id)


async def list_tickets(
    db: DbSession,
    *,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    priority: str | None = None,
    ticket_type: str | None = None,
    requester_id: uuid.UUID | None = None,
    assigned_to_id: uuid.UUID | None = None,
    search: str | None = None,
) -> tuple[list[Ticket], int, int, int]:
    page = max(page, 1)
    limit = min(max(limit, 1), 100)

    conditions = []
    if status:
        conditions.append(Ticket.status.has(TicketStatus.code == status))
    if priority:
        conditions.append(Ticket.priority == priority)
    if ticket_type:
        conditions.append(Ticket.ticket_type == ticket_type)
    if requester_id is not None:
        conditions.append(Ticket.requester_id == requester_id)
    if assigned_to_id is not None:
        conditions.append(Ticket.assigned_to_id == assigned_to_id)
    if search:
        # Búsqueda libre (pedida explícitamente para los 3 roles): por
        # número de caso o por palabra clave en asunto/descripción — un
        # solo cuadro, sin distinguir "modo" de búsqueda, el patrón ILIKE
        # cubre los dos usos a la vez. `%search%` en vez de full-text
        # search: volumen de datos bajo (cientos de tickets, no millones),
        # no justifica la complejidad de un índice GIN/tsvector.
        pattern = f"%{search}%"
        conditions.append(
            or_(
                Ticket.ticket_number.ilike(pattern),
                Ticket.subject.ilike(pattern),
                Ticket.description.ilike(pattern),
            )
        )

    count_stmt = select(func.count()).select_from(Ticket).where(*conditions)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Ticket)
        .where(*conditions)
        .order_by(Ticket.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    tickets = list((await db.execute(stmt)).scalars().unique().all())

    return tickets, total, page, limit


async def get_one(db: DbSession, ticket_id: uuid.UUID, actor: User | None = None) -> Ticket:
    """`actor` es opcional a propósito: las rutas alcanzables solo por
    ADMIN/TECHNICIAN (update, assign) no necesitan repetir el chequeo de
    propiedad, porque un Usuario Final nunca llega a ejecutarlas. Las rutas
    alcanzables por Usuario Final (detalle, historial, comentarios,
    reapertura) SIEMPRE deben pasar el actor.

    `populate_existing=True` es necesario porque la sesión usa
    `expire_on_commit=False` (ver app/database.py): sin esto, cuando este
    mismo Ticket ya está en el mapa de identidad de la sesión (ej. se llamó
    a get_one() al principio de change_status()/assign_ticket() y se
    modificó status_id/assigned_to_id como columna cruda), una segunda
    consulta para "releer el estado actual" reutilizaría el objeto en
    memoria SIN refrescar sus relaciones ya cargadas (`ticket.status`,
    `ticket.assigned_to`, etc. quedarían apuntando al valor viejo aunque la
    columna FK y la base de datos ya tengan el valor correcto)."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id).execution_options(populate_existing=True)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise TicketNotFoundError(ticket_id)
    if actor is not None:
        _assert_can_access_ticket(ticket, actor)
    return ticket


async def update_ticket(db: DbSession, ticket_id: uuid.UUID, dto: UpdateTicketDto, actor: User | None = None) -> Ticket:
    ticket = await get_one(db, ticket_id)
    _assert_ticket_not_closed(ticket)

    old_values = {
        "categoryId": ticket.category_id,
        "subcategoryId": ticket.subcategory_id,
        "typificationId": ticket.typification_id,
        "subject": ticket.subject,
        "description": ticket.description,
        "priority": ticket.priority,
        "ticketType": ticket.ticket_type,
    }

    # A diferencia de create(), aquí NO se exige todo-o-nada: si no vienen
    # los tres juntos, la reclasificación simplemente se ignora (mismo
    # comportamiento que TicketsService.update del original).
    if dto.category_id and dto.subcategory_id and dto.typification_id:
        await classification_service.validate_chain(
            db, dto.category_id, dto.subcategory_id, dto.typification_id
        )
        ticket.category_id = dto.category_id
        ticket.subcategory_id = dto.subcategory_id
        ticket.typification_id = dto.typification_id

    if dto.subject is not None:
        ticket.subject = dto.subject
    if dto.description is not None:
        ticket.description = dto.description
    if dto.priority is not None:
        ticket.priority = dto.priority.value
    if dto.ticket_type is not None:
        ticket.ticket_type = dto.ticket_type.value

    await audit_service.record_update(
        db,
        actor,
        entity="Ticket",
        entity_id=ticket_id,
        old_values=old_values,
        new_values={
            "categoryId": ticket.category_id,
            "subcategoryId": ticket.subcategory_id,
            "typificationId": ticket.typification_id,
            "subject": ticket.subject,
            "description": ticket.description,
            "priority": ticket.priority,
            "ticketType": ticket.ticket_type,
        },
    )

    await db.commit()
    return await get_one(db, ticket_id)


async def assign_ticket(
    db: DbSession, ticket_id: uuid.UUID, dto: AssignTicketDto, assigned_by: User
) -> Ticket:
    ticket = await get_one(db, ticket_id)
    _assert_ticket_not_closed(ticket)
    assigned_status = await _get_status_by_code(db, "ASSIGNED")

    previous_assignee = ticket.assigned_to_id
    ticket.assigned_to_id = dto.technician_id
    ticket.status_id = assigned_status.id

    db.add(
        TicketAssignmentHistory(
            ticket_id=ticket_id,
            from_user_id=previous_assignee,
            to_user_id=dto.technician_id,
            assigned_by=assigned_by.id,
            reason=dto.reason,
        )
    )

    await audit_service.record(
        db,
        user_id=assigned_by.id,
        action="ASSIGN",
        entity="Ticket",
        entity_id=str(ticket_id),
        old_values={"assignedTo": str(previous_assignee) if previous_assignee else None},
        new_values={"assignedTo": str(dto.technician_id), "reason": dto.reason},
    )

    await db.commit()
    return await get_one(db, ticket_id)


async def change_status(
    db: DbSession, ticket_id: uuid.UUID, dto: ChangeTicketStatusDto, actor: User
) -> Ticket:
    """Alcanzable por Usuario Final (a diferencia de update/assign) porque
    es la única vía para que reabra SU PROPIO ticket resuelto; por eso
    siempre se resuelve con `actor` para aplicar el chequeo de propiedad.

    CLOSED es terminal de verdad: ni Admin ni Técnico pueden reabrirlo o
    cambiar su estado una vez cerrado (a propósito, sin excepción de rol).
    """
    ticket = await get_one(db, ticket_id, actor=actor)
    from_status = ticket.status

    if from_status.code == "CLOSED":
        raise TicketClosedError()

    to_status = await _get_status_by_code(db, dto.to_status.value)

    if actor.role.code == "END_USER":
        if dto.to_status.value != "REOPENED" or from_status.code != "RESOLVED":
            raise InvalidStatusTransitionError()

    ticket.status_id = to_status.id
    now = datetime.now(timezone.utc)
    if dto.to_status.value == "RESOLVED":
        ticket.resolved_at = now
    if dto.to_status.value == "CLOSED":
        ticket.closed_at = now
    if dto.to_status.value == "REOPENED":
        ticket.reopened_count += 1

    db.add(
        TicketStatusHistory(
            ticket_id=ticket_id,
            from_status_id=from_status.id,
            to_status_id=to_status.id,
            changed_by=actor.id,
            reason=dto.reason,
        )
    )

    # El motivo también queda como comentario público (además del
    # historial), porque el timeline es compacto y difícil de leer; el
    # hilo de comentarios da más espacio para revisar la traza.
    db.add(
        TicketComment(
            ticket_id=ticket_id,
            author_id=actor.id,
            body=f"Cambio de estado: {from_status.name} → {to_status.name}\nMotivo: {dto.reason}",
            is_internal=False,
        )
    )

    await audit_service.record(
        db,
        user_id=actor.id,
        action="CHANGE_STATUS",
        entity="Ticket",
        entity_id=str(ticket_id),
        old_values={"status": from_status.code},
        new_values={"status": to_status.code, "reason": dto.reason},
    )

    await db.commit()
    return await get_one(db, ticket_id)


async def add_comment(
    db: DbSession, ticket_id: uuid.UUID, dto: CreateCommentDto, author: User
) -> TicketComment:
    ticket = await get_one(db, ticket_id, actor=author)
    _assert_ticket_not_closed(ticket)

    # Un Usuario Final nunca puede publicar comentarios internos, sin
    # importar lo que haya enviado en el formulario.
    is_internal = False if author.role.code == "END_USER" else bool(dto.is_internal)

    comment = TicketComment(ticket_id=ticket_id, author_id=author.id, body=dto.body, is_internal=is_internal)
    db.add(comment)
    await db.commit()

    result = await db.execute(select(TicketComment).where(TicketComment.id == comment.id))
    return result.scalar_one()


async def list_comments(db: DbSession, ticket_id: uuid.UUID, actor: User) -> list[TicketComment]:
    await get_one(db, ticket_id, actor=actor)

    stmt = select(TicketComment).where(TicketComment.ticket_id == ticket_id).order_by(TicketComment.created_at)
    if actor.role.code == "END_USER":
        stmt = stmt.where(TicketComment.is_internal.is_(False))

    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_history(db: DbSession, ticket_id: uuid.UUID, actor: User) -> list[dict]:
    """Línea de tiempo combinada (cambios de estado + reasignaciones),
    ordenada cronológicamente ascendente."""
    await get_one(db, ticket_id, actor=actor)

    status_result = await db.execute(
        select(TicketStatusHistory)
        .where(TicketStatusHistory.ticket_id == ticket_id)
        .order_by(TicketStatusHistory.created_at)
    )
    status_events = status_result.scalars().unique().all()

    assignment_result = await db.execute(
        select(TicketAssignmentHistory)
        .where(TicketAssignmentHistory.ticket_id == ticket_id)
        .order_by(TicketAssignmentHistory.created_at)
    )
    assignment_events = assignment_result.scalars().unique().all()

    timeline = [
        {
            "type": "STATUS_CHANGE",
            "created_at": e.created_at,
            "from": e.from_status.name if e.from_status else None,
            "to": e.to_status.name,
            "by": e.changed_by_user.full_name if e.changed_by_user else "Sistema",
            "reason": e.reason,
        }
        for e in status_events
    ] + [
        {
            "type": "ASSIGNMENT",
            "created_at": e.created_at,
            "from": e.from_user.full_name if e.from_user else None,
            "to": e.to_user.full_name,
            "by": e.assigned_by_user.full_name,
            "reason": e.reason,
        }
        for e in assignment_events
    ]
    timeline.sort(key=lambda item: item["created_at"])
    return timeline
