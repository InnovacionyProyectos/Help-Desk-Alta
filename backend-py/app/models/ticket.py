import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# created_at/updated_at usan server_default=now() por la misma razon que en
# classification.py: la tabla real los rellena con DEFAULT now() (updated_at
# ademas se mantiene con el trigger trg_set_updated_at en cada UPDATE) — sin
# server_default, SQLAlchemy manda NULL explicito en el INSERT.
#
# Los ids UUID (Ticket, TicketComment) usan default=uuid.uuid4 en Python
# (mismo patron que Session en app/models/session.py), no server_default,
# porque necesitamos conocer el id antes del commit para insertar filas de
# historial relacionadas en la misma unidad de trabajo.


class TicketStatus(Base):
    __tablename__ = "ticket_statuses"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(50))
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True)
    subject: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)

    # Nulas a proposito: el Usuario Final solo diligencia asunto/descripcion
    # al crear el ticket; la clasificacion puede llegar completa (Admin/
    # Tecnico creando en nombre de alguien) o asignarse despues via update.
    category_id: Mapped[int | None] = mapped_column(ForeignKey("ticket_categories.id"))
    subcategory_id: Mapped[int | None] = mapped_column(ForeignKey("ticket_subcategories.id"))
    typification_id: Mapped[int | None] = mapped_column(ForeignKey("ticket_typifications.id"))

    status_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("ticket_statuses.id"))
    # CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')) ya existe en el DDL.
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    # CHECK (ticket_type IN ('INCIDENTE','REQUERIMIENTO','CONSULTA')) ya existe en el DDL.
    ticket_type: Mapped[str] = mapped_column(String(20), default="INCIDENTE")

    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id"))

    resolved_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    reopened_count: Mapped[int] = mapped_column(SmallInteger, default=0)

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    status: Mapped["TicketStatus"] = relationship(lazy="joined")
    category: Mapped["TicketCategory | None"] = relationship(lazy="joined", viewonly=False)
    subcategory: Mapped["TicketSubcategory | None"] = relationship(lazy="joined", viewonly=False)
    typification: Mapped["TicketTypification | None"] = relationship(lazy="joined", viewonly=False)
    requester: Mapped["User"] = relationship(foreign_keys=[requester_id], lazy="joined")
    assigned_to: Mapped["User | None"] = relationship(foreign_keys=[assigned_to_id], lazy="joined")
    assigned_area: Mapped["Area | None"] = relationship(lazy="joined")

    comments: Mapped[list["TicketComment"]] = relationship(
        back_populates="ticket", passive_deletes=True, order_by="TicketComment.created_at"
    )
    status_history: Mapped[list["TicketStatusHistory"]] = relationship(
        back_populates="ticket", passive_deletes=True
    )
    assignment_history: Mapped[list["TicketAssignmentHistory"]] = relationship(
        back_populates="ticket", passive_deletes=True
    )


class TicketStatusHistory(Base):
    __tablename__ = "ticket_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE")
    )
    from_status_id: Mapped[int | None] = mapped_column(SmallInteger, ForeignKey("ticket_statuses.id"))
    to_status_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("ticket_statuses.id"))
    # NULL = accion automatica del sistema (ej. cierre a 24h del job de Fase 4).
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    ticket: Mapped["Ticket"] = relationship(back_populates="status_history")
    from_status: Mapped["TicketStatus | None"] = relationship(foreign_keys=[from_status_id], lazy="joined")
    to_status: Mapped["TicketStatus"] = relationship(foreign_keys=[to_status_id], lazy="joined")
    changed_by_user: Mapped["User | None"] = relationship(foreign_keys=[changed_by], lazy="joined")


class TicketAssignmentHistory(Base):
    __tablename__ = "ticket_assignment_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE")
    )
    from_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    to_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    ticket: Mapped["Ticket"] = relationship(back_populates="assignment_history")
    from_user: Mapped["User | None"] = relationship(foreign_keys=[from_user_id], lazy="joined")
    to_user: Mapped["User"] = relationship(foreign_keys=[to_user_id], lazy="joined")
    assigned_by_user: Mapped["User"] = relationship(foreign_keys=[assigned_by], lazy="joined")


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE")
    )
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    ticket: Mapped["Ticket"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(lazy="joined")
