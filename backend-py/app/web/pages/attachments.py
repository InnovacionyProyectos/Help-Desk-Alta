"""Rutas de página + fragmentos HTMX de Adjuntos. Equivalente a
attachments.controller.ts del backend NestJS original. Sigue el mismo patrón
que app/web/pages/tickets.py: excepciones del servicio se atrapan en cada
ruta y se traducen a HTTPException (mismos códigos que las demás cards de
tickets: 404/403/409); la card de Adjuntos sigue la misma estructura visual
que _comments_card.html.

Sin restricción de rol a propósito: el AttachmentsController original no
tiene @UseGuards(RolesGuard) — cualquier usuario autenticado con acceso al
ticket (chequeo de propiedad vía ticket_service.get_one) puede subir/listar/
descargar adjuntos, END_USER incluido."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.database import get_db
from app.security.deps import CurrentUser
from app.services import attachments_service, ticket_service
from app.services.attachments_exceptions import (
    AttachmentNotFoundError,
    FileTooLargeError,
    InvalidExtensionError,
)
from app.services.ticket_exceptions import (
    ForbiddenTicketAccessError,
    TicketClosedError,
    TicketNotFoundError,
)
from app.templating import templates

router = APIRouter()

Db = Annotated[DbSession, Depends(get_db)]


async def _attachments_fragment(request: Request, db: Db, ticket_id: uuid.UUID, user):
    ticket = await ticket_service.get_one(db, ticket_id, actor=user)
    attachments = await attachments_service.list_by_ticket(db, ticket_id, user)
    return templates.TemplateResponse(
        request,
        "tickets/_attachments_card.html",
        {
            "ticket": ticket,
            "attachments": attachments,
            "is_closed": ticket.status.code == "CLOSED",
        },
    )


@router.get("/tickets/{ticket_id}/attachments")
async def attachments_fragment(ticket_id: uuid.UUID, request: Request, user: CurrentUser, db: Db):
    try:
        return await _attachments_fragment(request, db, ticket_id, user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/tickets/{ticket_id}/attachments")
async def upload_attachment(
    ticket_id: uuid.UUID,
    request: Request,
    user: CurrentUser,
    db: Db,
    file: Annotated[UploadFile, File()],
    comment_id: Annotated[str, Form()] = "",
):
    comment_uuid: uuid.UUID | None = None
    if comment_id:
        try:
            comment_uuid = uuid.UUID(comment_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="comment_id inválido") from exc

    try:
        await attachments_service.upload(db, ticket_id, file, comment_uuid, user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TicketClosedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except InvalidExtensionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return await _attachments_fragment(request, db, ticket_id, user)


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(attachment_id: uuid.UUID, user: CurrentUser, db: Db):
    try:
        attachment, absolute_path = await attachments_service.get_for_download(db, attachment_id, user)
    except AttachmentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForbiddenTicketAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if not absolute_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo ya no existe en el almacenamiento")

    return FileResponse(path=absolute_path, filename=attachment.file_name, media_type=attachment.mime_type)
