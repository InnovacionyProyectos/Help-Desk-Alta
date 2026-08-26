import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, BigInteger, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Igual que Ticket/TicketComment (ver app/models/ticket.py): id UUID generado
# en Python con default=uuid.uuid4, no server_default, porque
# attachments_service necesita conocer el id antes de exponerlo en el
# fragmento de respuesta dentro de la misma unidad de trabajo.


class TicketAttachment(Base):
    """Adjunto de un ticket, ligado opcionalmente a un comentario. `storage_key`
    es la ruta relativa en disco y NUNCA se expone al cliente — las descargas
    van siempre por `id` (ver GET /attachments/{id}/download), nunca por ruta.

    `deleted_at` es un soft-delete que existe en el esquema real pero no se
    usa: el NestJS original no tiene endpoint de borrado de adjuntos, así que
    esta reescritura tampoco lo agrega. list_by_ticket() lo filtra por si
    alguna vez se puebla manualmente, pero no hay setter en este servicio."""

    __tablename__ = "ticket_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE")
    )
    comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ticket_comments.id", ondelete="CASCADE")
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    file_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    uploaded_by_user: Mapped["User"] = relationship(foreign_keys=[uploaded_by], lazy="joined")
