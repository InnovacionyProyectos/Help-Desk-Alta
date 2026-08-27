"""Réplica de los DTO de class-validator del módulo tickets del backend
NestJS original (backend/src/modules/tickets/dto/*.dto.ts y
enums/*.enum.ts)."""

import enum
import uuid

from pydantic import BaseModel, Field, field_validator


class TicketStatusCode(str, enum.Enum):
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    ON_HOLD = "ON_HOLD"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"


class TicketPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TicketType(str, enum.Enum):
    INCIDENTE = "INCIDENTE"
    REQUERIMIENTO = "REQUERIMIENTO"
    CONSULTA = "CONSULTA"


class CreateTicketDto(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    category_id: int | None = None
    subcategory_id: int | None = None
    typification_id: int | None = None
    # Si no se envía, el ticket queda en MEDIUM (la prioridad ya no se
    # hereda de la tipificación, ver decisión de negocio en
    # ticket_service.create_ticket()). No incluye ticket_type a propósito:
    # el DTO original tampoco lo tiene, el ticket siempre nace INCIDENTE
    # (default de columna) y se cambia después con UpdateTicketDto.
    priority: TicketPriority | None = None
    # Solo Admin/Técnico pueden enviarlo (crear "a nombre de" otro
    # usuario, mejora post-corte pedida explícitamente) — un END_USER
    # siempre crea a nombre propio, sin excepción; ver el chequeo
    # server-side en ticket_service.create_ticket().
    requester_id: uuid.UUID | None = None


class UpdateTicketDto(BaseModel):
    subject: str | None = Field(default=None, max_length=200)
    description: str | None = None
    category_id: int | None = None
    subcategory_id: int | None = None
    typification_id: int | None = None
    priority: TicketPriority | None = None
    ticket_type: TicketType | None = None


class AssignTicketDto(BaseModel):
    technician_id: uuid.UUID
    reason: str | None = Field(default=None, max_length=255)


class ChangeTicketStatusDto(BaseModel):
    to_status: TicketStatusCode
    reason: str = Field(min_length=1, max_length=255)

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El motivo es obligatorio")
        return stripped


class CreateCommentDto(BaseModel):
    body: str = Field(min_length=1)
    is_internal: bool | None = None
