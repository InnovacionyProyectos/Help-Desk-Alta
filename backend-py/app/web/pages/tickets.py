"""Rutas de página completa + fragmentos HTMX del núcleo de Tickets.
Equivalente combinado de tickets.controller.ts (backend NestJS original) y
las vistas React de frontend/src/features/tickets. Sigue el mismo patrón que
admin_classification.py: excepciones del servicio se atrapan en cada ruta y
se traducen a HTTPException; los fragmentos HTMX devuelven solo el card que
cambió (+ el header en un swap fuera de banda cuando el header también
cambió)."""

import json
import uuid
from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.database import get_db
from app.models.role import Role
from app.models.ticket import TicketStatus
from app.models.user import User
from app.schemas.ticket import (
    AssignTicketDto,
    ChangeTicketStatusDto,
    CreateCommentDto,
    CreateTicketDto,
    UpdateTicketDto,
)
from app.security.deps import CurrentUser, require_role
from app.services import attachments_service, classification_service, ticket_service
from app.services.attachments_exceptions import FileTooLargeError, InvalidExtensionError
from app.services.classification_exceptions import InvalidClassificationChainError
from app.services.ticket_exceptions import (
    ForbiddenTicketAccessError,
    IncompleteClassificationError,
    InvalidStatusTransitionError,
    RequesterNotFoundError,
    TicketClosedError,
    TicketNotFoundError,
)
from app.templating import templates

router = APIRouter()

Db = Annotated[DbSession, Depends(get_db)]
StaffOnly = Annotated[User, Depends(require_role("ADMIN", "TECHNICIAN"))]

TYPE_LABELS = {"INCIDENTE": "Incidente", "REQUERIMIENTO": "Requerimiento", "CONSULTA": "Consulta"}
PRIORITY_LABELS = {"LOW": "Baja", "MEDIUM": "Media", "HIGH": "Alta", "CRITICAL": "Crítica"}


# ===================================================================
# Helpers internos
# ===================================================================


async def _list_assignable_staff(db: Db) -> list[User]:
    """Para el <select> de "Asignar a" de la card de Acciones — Admin y
    Técnico, no solo Técnico (mejora post-corte, pedida explícitamente:
    "en varias ocasiones los administradores pueden atender casos")."""
    result = await db.execute(
        select(User)
        .where(User.role.has(Role.code.in_(("ADMIN", "TECHNICIAN"))), User.is_active.is_(True))
        .order_by(User.first_name, User.last_name)
    )
    return list(result.scalars().unique().all())


async def _list_active_users(db: Db) -> list[User]:
    """Para el <select> de "Crear a nombre de" en /tickets/new — solo
    Admin/Técnico lo ven. Todos los roles activos (no solo END_USER):
    staff a veces crea un ticket a nombre de otro miembro del equipo, no
    únicamente de un usuario final."""
    result = await db.execute(
        select(User)
        .where(User.deleted_at.is_(None), User.is_active.is_(True))
        .order_by(User.first_name, User.last_name)
    )
    return list(result.scalars().unique().all())


async def _list_statuses(db: Db) -> list[TicketStatus]:
    result = await db.execute(select(TicketStatus).order_by(TicketStatus.display_order))
    return list(result.scalars().all())


async def _cascade_json(db: Db) -> str:
    cascade = await classification_service.get_cascade(db)
    return json.dumps([c.model_dump() for c in cascade])


def _is_staff(user: User) -> bool:
    return user.role.code in ("ADMIN", "TECHNICIAN")


def _base_ctx(user: User, **extra) -> dict:
    return {
        "current_user": user,
        "active_nav": "tickets",
        "type_labels": TYPE_LABELS,
        "priority_labels": PRIORITY_LABELS,
        **extra,
    }


# ===================================================================
# Listado
# ===================================================================


@router.get("/tickets")
async def list_page(
    request: Request,
    user: CurrentUser,
    db: Db,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    status: str = "",
    status_in: str = "",
    priority: str = "",
    ticket_type: str = "",
    view: str = "",
    search: str = "",
):
    is_staff = _is_staff(user)
    if not is_staff:
        view = "mine"
    elif view not in ("all", "mine", "assigned"):
        view = "all"

    requester_id = user.id if view == "mine" else None
    assigned_to_id = user.id if view == "assigned" else None

    # `status_in` llega como códigos separados por coma desde el atajo del
    # panel ("Tickets pendientes de gestión", ver dashboard/admin.html) —
    # no es un campo del formulario de filtros, así que se pierde en cuanto
    # el usuario use el <select> normal, que es el comportamiento esperado.
    status_in_list = [code for code in status_in.split(",") if code] or None

    tickets, total, page, limit = await ticket_service.list_tickets(
        db,
        page=page,
        limit=limit,
        status=status or None,
        status_in=status_in_list,
        priority=priority or None,
        ticket_type=ticket_type or None,
        requester_id=requester_id,
        assigned_to_id=assigned_to_id,
        search=search or None,
    )
    total_pages = max((total + limit - 1) // limit, 1)
    statuses = await _list_statuses(db)

    return templates.TemplateResponse(
        request,
        "tickets/list.html",
        _base_ctx(
            user,
            tickets=tickets,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            is_staff=is_staff,
            view=view,
            statuses=statuses,
            filter_status=status,
            filter_status_in=status_in,
            filter_priority=priority,
            filter_type=ticket_type,
            filter_search=search,
        ),
    )


# ===================================================================
# Creación
# ===================================================================


@router.get("/tickets/new")
async def new_ticket_form(request: Request, user: CurrentUser, db: Db):
    is_staff = _is_staff(user)
    return templates.TemplateResponse(
        request,
        "tickets/new.html",
        _base_ctx(
            user,
            active_nav="ticket-new",
            cascade_json=await _cascade_json(db) if is_staff else "[]",
            error=None,
            values={},
            is_staff=is_staff,
            requester_users=await _list_active_users(db) if is_staff else [],
        ),
    )


@router.post("/tickets/new")
async def create_ticket_submit(
    request: Request,
    user: CurrentUser,
    db: Db,
    subject: Annotated[str, Form()],
    description: Annotated[str, Form()],
    category_id: Annotated[str, Form()] = "",
    subcategory_id: Annotated[str, Form()] = "",
    typification_id: Annotated[str, Form()] = "",
    priority: Annotated[str, Form()] = "",
    requester_id: Annotated[str, Form()] = "",
    file: Annotated[UploadFile | None, File()] = None,
):
    # El Usuario Final solo diligencia asunto/descripción — clasificación,
    # prioridad y "crear a nombre de" son campos de Admin/Técnico, tanto en
    # la UI (ocultos en new.html si !is_staff) como aquí server-side, para
    # que no se puedan colar posteando el form a mano sin pasar por el
    # formulario visible.
    if not _is_staff(user):
        category_id = subcategory_id = typification_id = priority = requester_id = ""

    values = {
        "subject": subject,
        "description": description,
        "category_id": category_id,
        "subcategory_id": subcategory_id,
        "typification_id": typification_id,
        "priority": priority,
        "requester_id": requester_id,
    }

    try:
        dto = CreateTicketDto(
            subject=subject,
            description=description,
            category_id=int(category_id) if category_id else None,
            subcategory_id=int(subcategory_id) if subcategory_id else None,
            typification_id=int(typification_id) if typification_id else None,
            priority=priority or None,
            requester_id=requester_id or None,
        )
    except ValidationError:
        return await _rerender_new_with_cascade(request, user, db, "Datos inválidos: revise el formulario", values)

    try:
        ticket = await ticket_service.create_ticket(db, dto, user)
    except IncompleteClassificationError as exc:
        return await _rerender_new_with_cascade(request, user, db, str(exc), values)
    except InvalidClassificationChainError as exc:
        return await _rerender_new_with_cascade(request, user, db, str(exc), values)
    except RequesterNotFoundError as exc:
        return await _rerender_new_with_cascade(request, user, db, str(exc), values)

    # Adjunto opcional en el mismo formulario de creación, disponible para
    # los 3 roles (Usuario Final incluido — antes solo podía adjuntar
    # DESPUÉS de creado el ticket, desde la card de Adjuntos del detalle).
    # No se pasa por ticket_service.create_ticket() porque el adjunto
    # necesita el id del ticket, que recién existe después del flush/commit
    # de arriba — se sube aparte, reusando attachments_service.upload()
    # (misma validación de tamaño/extensión que la subida normal). Si la
    # subida falla, el ticket ya se creó y NO se pierde por eso — se
    # redirige al detalle con un aviso, igual que si lo hubiera intentado
    # adjuntar justo después desde ahí.
    if file is not None and file.filename:
        try:
            await attachments_service.upload(db, ticket.id, file, None, user)
        except (FileTooLargeError, InvalidExtensionError) as exc:
            query = urlencode({"attach_error": str(exc)})
            return RedirectResponse(url=f"/tickets/{ticket.id}?{query}", status_code=303)

    return RedirectResponse(url=f"/tickets/{ticket.id}", status_code=303)


async def _rerender_new_with_cascade(request: Request, user: User, db: Db, error: str, values: dict):
    is_staff = _is_staff(user)
    return templates.TemplateResponse(
        request,
        "tickets/new.html",
        _base_ctx(
            user,
            active_nav="ticket-new",
            cascade_json=await _cascade_json(db) if is_staff else "[]",
            error=error,
            values=values,
            is_staff=is_staff,
            requester_users=await _list_active_users(db) if is_staff else [],
        ),
        status_code=400,
    )


# ===================================================================
# Detalle
# ===================================================================


@router.get("/tickets/{ticket_id}")
async def detail_page(
    ticket_id: uuid.UUID,
    request: Request,
    user: CurrentUser,
    db: Db,
    attach_error: Annotated[str | None, Query()] = None,
):
    try:
        ticket = await ticket_service.get_one(db, ticket_id, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    comments = await ticket_service.list_comments(db, ticket_id, actor=user)
    history = await ticket_service.get_history(db, ticket_id, actor=user)
    attachments = await attachments_service.list_by_ticket(db, ticket_id, user)

    is_staff = _is_staff(user)
    technicians = await _list_assignable_staff(db) if is_staff else []
    statuses = await _list_statuses(db)
    cascade_json = await _cascade_json(db) if is_staff else "[]"

    return templates.TemplateResponse(
        request,
        "tickets/detail.html",
        _base_ctx(
            user,
            ticket=ticket,
            comments=comments,
            history=history,
            attachments=attachments,
            technicians=technicians,
            statuses=statuses,
            cascade_json=cascade_json,
            is_staff=is_staff,
            is_end_user=not is_staff,
            is_closed=ticket.status.code == "CLOSED",
            attach_error=attach_error,
        ),
    )


# ===================================================================
# Fragmentos de refresco (hx-trigger="ticket-updated from:body")
# ===================================================================


@router.get("/tickets/{ticket_id}/fragments/history")
async def history_fragment(ticket_id: uuid.UUID, request: Request, user: CurrentUser, db: Db):
    try:
        ticket = await ticket_service.get_one(db, ticket_id, actor=user)
        history = await ticket_service.get_history(db, ticket_id, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request, "tickets/_history_card.html", {"ticket": ticket, "history": history}
    )


@router.get("/tickets/{ticket_id}/fragments/comments")
async def comments_fragment(ticket_id: uuid.UUID, request: Request, user: CurrentUser, db: Db):
    try:
        ticket = await ticket_service.get_one(db, ticket_id, actor=user)
        comments = await ticket_service.list_comments(db, ticket_id, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return templates.TemplateResponse(
        request,
        "tickets/_comments_card.html",
        {
            "ticket": ticket,
            "comments": comments,
            "is_staff": _is_staff(user),
            "is_closed": ticket.status.code == "CLOSED",
        },
    )


# ===================================================================
# Acciones — Tipo / Clasificación / Prioridad (solo ADMIN/TECHNICIAN)
# ===================================================================


@router.post("/tickets/{ticket_id}/type")
async def change_type(
    ticket_id: uuid.UUID,
    request: Request,
    user: StaffOnly,
    db: Db,
    ticket_type: Annotated[str, Form()],
):
    try:
        dto = UpdateTicketDto(ticket_type=ticket_type)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Tipo inválido") from exc
    try:
        ticket = await ticket_service.update_ticket(db, ticket_id, dto, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TicketClosedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return templates.TemplateResponse(
        request, "tickets/_type_card_response.html", _base_ctx(user, ticket=ticket, is_closed=False)
    )


@router.post("/tickets/{ticket_id}/priority")
async def change_priority(
    ticket_id: uuid.UUID,
    request: Request,
    user: StaffOnly,
    db: Db,
    priority: Annotated[str, Form()],
):
    try:
        dto = UpdateTicketDto(priority=priority)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Prioridad inválida") from exc
    try:
        ticket = await ticket_service.update_ticket(db, ticket_id, dto, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TicketClosedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return templates.TemplateResponse(
        request, "tickets/_priority_card_response.html", _base_ctx(user, ticket=ticket, is_closed=False)
    )


@router.post("/tickets/{ticket_id}/classification")
async def reclassify(
    ticket_id: uuid.UUID,
    request: Request,
    user: StaffOnly,
    db: Db,
    category_id: Annotated[int, Form()],
    subcategory_id: Annotated[int, Form()],
    typification_id: Annotated[int, Form()],
):
    dto = UpdateTicketDto(category_id=category_id, subcategory_id=subcategory_id, typification_id=typification_id)
    try:
        ticket = await ticket_service.update_ticket(db, ticket_id, dto, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TicketClosedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except InvalidClassificationChainError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return templates.TemplateResponse(
        request,
        "tickets/_classification_card_response.html",
        _base_ctx(user, ticket=ticket, is_closed=False, cascade_json=await _cascade_json(db)),
    )


# ===================================================================
# Acciones — Asignar / Cambiar estado (card "Acciones")
# ===================================================================


@router.post("/tickets/{ticket_id}/assign")
async def assign_ticket_submit(
    ticket_id: uuid.UUID,
    request: Request,
    user: StaffOnly,
    db: Db,
    technician_id: Annotated[str, Form()],
    reason: Annotated[str, Form()] = "",
):
    try:
        dto = AssignTicketDto(technician_id=technician_id, reason=reason or None)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Técnico inválido") from exc
    try:
        ticket = await ticket_service.assign_ticket(db, ticket_id, dto, user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TicketClosedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    response = templates.TemplateResponse(
        request,
        "tickets/_actions_card_response.html",
        _base_ctx(
            user,
            ticket=ticket,
            technicians=await _list_assignable_staff(db),
            statuses=await _list_statuses(db),
            is_staff=True,
            is_closed=ticket.status.code == "CLOSED",
        ),
    )
    response.headers["HX-Trigger"] = "ticket-updated"
    return response


@router.post("/tickets/{ticket_id}/status")
async def change_status_submit(
    ticket_id: uuid.UUID,
    request: Request,
    user: CurrentUser,
    db: Db,
    to_status: Annotated[str, Form()],
    reason: Annotated[str, Form()],
):
    try:
        dto = ChangeTicketStatusDto(to_status=to_status, reason=reason)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="El motivo es obligatorio") from exc

    try:
        ticket = await ticket_service.change_status(db, ticket_id, dto, user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TicketClosedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except InvalidStatusTransitionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    is_staff = _is_staff(user)
    response = templates.TemplateResponse(
        request,
        "tickets/_actions_card_response.html",
        _base_ctx(
            user,
            ticket=ticket,
            technicians=await _list_assignable_staff(db) if is_staff else [],
            statuses=await _list_statuses(db),
            is_staff=is_staff,
            is_closed=ticket.status.code == "CLOSED",
        ),
    )
    response.headers["HX-Trigger"] = "ticket-updated"
    return response


# ===================================================================
# Comentarios
# ===================================================================


@router.post("/tickets/{ticket_id}/comments")
async def add_comment_submit(
    ticket_id: uuid.UUID,
    request: Request,
    user: CurrentUser,
    db: Db,
    body: Annotated[str, Form()],
    is_internal: Annotated[str, Form()] = "",
):
    try:
        dto = CreateCommentDto(body=body, is_internal=bool(is_internal))
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío") from exc

    try:
        await ticket_service.add_comment(db, ticket_id, dto, user)
        ticket = await ticket_service.get_one(db, ticket_id, actor=user)
        comments = await ticket_service.list_comments(db, ticket_id, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TicketClosedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return templates.TemplateResponse(
        request,
        "tickets/_comments_card.html",
        {
            "ticket": ticket,
            "comments": comments,
            "is_staff": _is_staff(user),
            "is_closed": ticket.status.code == "CLOSED",
        },
    )
