"""Equivalente a reports.service.ts del backend NestJS original. Funciones
puras: la consulta filtrada de tickets, y el cálculo de agregados para el
resumen gerencial (mismo filtro anti-inconsistencia que dashboard_service,
aplicado en Python sobre la lista ya filtrada para no repetir la query)."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.models.ticket import Ticket, TicketStatus

PRIORITY_LABELS = {"LOW": "Baja", "MEDIUM": "Media", "HIGH": "Alta", "CRITICAL": "Crítica"}
STATUS_LABELS = {
    "OPEN": "Abierto",
    "ASSIGNED": "Asignado",
    "IN_PROGRESS": "En progreso",
    "ON_HOLD": "En espera",
    "RESOLVED": "Resuelto",
    "CLOSED": "Cerrado",
    "REOPENED": "Reabierto",
}


async def query_tickets(
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    area_id: int | None = None,
) -> list[Ticket]:
    """Filtro compartido por Excel y los 2 PDF — todos los filtros son
    opcionales y se combinan con AND, orden created_at DESC."""
    stmt = select(Ticket).order_by(Ticket.created_at.desc())
    if status:
        stmt = stmt.join(TicketStatus, Ticket.status_id == TicketStatus.id).where(TicketStatus.code == status)
    if date_from is not None:
        stmt = stmt.where(Ticket.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Ticket.created_at <= date_to)
    if area_id is not None:
        stmt = stmt.where(Ticket.assigned_area_id == area_id)

    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


def summarize(tickets: list[Ticket]) -> dict:
    """Agregados en Python sobre una lista ya filtrada (evita una segunda
    query): conteo por estado, por prioridad, y promedio de resolución con
    el mismo filtro anti-inconsistencia que dashboard_service.get_admin_metrics
    (resolved_at IS NOT NULL AND resolved_at >= created_at) — a propósito,
    no es un bug, descarta datos manualmente editados que arrastrarían el
    promedio a negativo."""
    by_status: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    resolution_hours: list[float] = []

    for t in tickets:
        by_status[t.status.code] = by_status.get(t.status.code, 0) + 1
        by_priority[t.priority] = by_priority.get(t.priority, 0) + 1
        if t.resolved_at is not None and t.resolved_at >= t.created_at:
            resolution_hours.append((t.resolved_at - t.created_at).total_seconds() / 3600)

    avg_resolution_hours = sum(resolution_hours) / len(resolution_hours) if resolution_hours else None

    return {
        "total": len(tickets),
        "by_status": by_status,
        "by_priority": by_priority,
        "avg_resolution_hours": avg_resolution_hours,
    }
