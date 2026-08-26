"""Equivalente a attachments.service.ts del backend NestJS original.
Reutiliza ticket_service.get_one() (existencia + chequeo de propiedad:
END_USER solo accede a sus propios tickets) y
ticket_service._assert_ticket_not_closed() (bloqueo total en CLOSED) en vez
de reimplementar esas reglas — ver plan de reescritura, Fase 5.

Los límites de subida (tamaño/extensión) se leen de system_config en CADA
subida, nunca hardcodeados, para que el Admin pueda cambiarlos sin redeploy
(mismo comportamiento que el original vía AttachmentUploadGuard)."""

import hashlib
import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.config import settings
from app.models.attachment import TicketAttachment
from app.models.user import User
from app.services import audit_service, system_config_service, ticket_service
from app.services.attachments_exceptions import (
    AttachmentNotFoundError,
    FileTooLargeError,
    InvalidExtensionError,
)
from app.services.ticket_service import _assert_ticket_not_closed

# re.ASCII para que \w se comporte igual que en JS (solo [A-Za-z0-9_]),
# replicando exactamente replace(/[^\w.\-]/g, '_') del original.
_UNSAFE_CHARS = re.compile(r"[^\w.\-]", re.ASCII)


def _sanitize_filename(name: str) -> str:
    return _UNSAFE_CHARS.sub("_", name)


def _storage_root() -> Path:
    return Path(settings.storage_local_path)


async def upload(
    db: DbSession,
    ticket_id: uuid.UUID,
    file: UploadFile,
    comment_id: uuid.UUID | None,
    uploader: User,
) -> TicketAttachment:
    # get_one() ya lanza TicketNotFoundError/ForbiddenTicketAccessError si el
    # ticket no existe o si un Usuario Final intenta subir a un ticket ajeno.
    ticket = await ticket_service.get_one(db, ticket_id, actor=uploader)
    _assert_ticket_not_closed(ticket)

    config = await system_config_service.get_config(db)

    content = await file.read()
    size_bytes = len(content)
    max_bytes = config.max_attachment_size_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise FileTooLargeError(config.max_attachment_size_mb)

    original_name = file.filename or "archivo"
    extension = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    allowed = [ext.lower() for ext in config.allowed_extensions]
    if extension not in allowed:
        raise InvalidExtensionError(config.allowed_extensions)

    safe_name = _sanitize_filename(original_name)
    attachment_id = uuid.uuid4()
    storage_key = str(Path("tickets") / str(ticket_id) / f"{attachment_id}__{safe_name}")

    ticket_dir = _storage_root() / "tickets" / str(ticket_id)
    ticket_dir.mkdir(parents=True, exist_ok=True)
    (_storage_root() / storage_key).write_bytes(content)

    checksum = hashlib.sha256(content).hexdigest()

    attachment = TicketAttachment(
        id=attachment_id,
        ticket_id=ticket_id,
        comment_id=comment_id,
        uploaded_by=uploader.id,
        file_name=original_name,
        storage_key=storage_key,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        checksum_sha256=checksum,
    )
    db.add(attachment)
    await audit_service.record_create(
        db,
        uploader,
        entity="TicketAttachment",
        entity_id=attachment_id,
        new_values={"ticketId": str(ticket_id), "fileName": original_name, "sizeBytes": size_bytes},
    )
    await db.commit()

    result = await db.execute(
        select(TicketAttachment)
        .where(TicketAttachment.id == attachment.id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def list_by_ticket(db: DbSession, ticket_id: uuid.UUID, requester: User) -> list[TicketAttachment]:
    # No bloquea en CLOSED a propósito: la lectura de adjuntos ya subidos
    # sigue disponible aunque el ticket esté cerrado (solo la subida se
    # bloquea) — mismo comportamiento que findByTicket() del original.
    await ticket_service.get_one(db, ticket_id, actor=requester)

    stmt = (
        select(TicketAttachment)
        .where(TicketAttachment.ticket_id == ticket_id, TicketAttachment.deleted_at.is_(None))
        .order_by(TicketAttachment.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_for_download(
    db: DbSession, attachment_id: uuid.UUID, requester: User
) -> tuple[TicketAttachment, Path]:
    result = await db.execute(select(TicketAttachment).where(TicketAttachment.id == attachment_id))
    attachment = result.scalar_one_or_none()
    if attachment is None or attachment.deleted_at is not None:
        raise AttachmentNotFoundError(attachment_id)

    # get_one() aplica el mismo chequeo de propiedad que el resto del módulo
    # de tickets (END_USER solo accede a adjuntos de sus propios tickets);
    # tampoco bloquea en CLOSED, igual que list_by_ticket().
    await ticket_service.get_one(db, attachment.ticket_id, actor=requester)

    absolute_path = _storage_root() / attachment.storage_key
    return attachment, absolute_path
