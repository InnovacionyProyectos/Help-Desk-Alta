"""Equivalente a dashboard.service.ts del backend NestJS original. Igual
que ticket_service.py, funciones puras que reciben `db: AsyncSession`
explícito."""

import uuid
from datetime import date

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.models.area import Area
from app.models.classification import TicketCategory
from app.models.ticket import Ticket, TicketStatus


def _month_range(month: str) -> tuple[date, date]:
    """Convierte "YYYY-MM" (formato de <input type="month">) en un rango
    [inicio, fin_exclusivo) de fechas naturales — fin_exclusivo es el
    primer día del mes siguiente, así el filtro `created_at >= inicio AND
    created_at < fin_exclusivo` cubre el mes completo (primer día al
    último, inclusive), sin depender de a qué hora del último día se creó
    el ticket."""
    year_str, month_str = month.split("-")
    year, mon = int(year_str), int(month_str)
    start = date(year, mon, 1)
    end_exclusive = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end_exclusive


async def get_admin_metrics(db: DbSession, month: str | None = None) -> dict:
    """Métricas globales: volumen por estado/prioridad/tipo/categoría/área
    y tiempo promedio de resolución.

    `month` (opcional, "YYYY-MM"): si se pasa, TODAS las agregaciones se
    filtran por `created_at` dentro de ese mes. Si no se pasa (o viene
    vacío), comportamiento sin cambios respecto a antes de esta mejora —
    todo el histórico, sin filtrar."""

    date_filter = None
    if month:
        start, end_exclusive = _month_range(month)
        date_filter = (Ticket.created_at >= start, Ticket.created_at < end_exclusive)

    # order_by(display_order) para que el gráfico mantenga siempre el mismo
    # orden de gajos (Abierto→Asignado→...) en vez del orden arbitrario que
    # devuelve el GROUP BY.
    by_status_stmt = (
        select(TicketStatus.code, func.count().label("total"))
        .select_from(Ticket)
        .join(TicketStatus, Ticket.status_id == TicketStatus.id)
        .group_by(TicketStatus.code, TicketStatus.display_order)
        .order_by(TicketStatus.display_order)
    )
    if date_filter:
        by_status_stmt = by_status_stmt.where(*date_filter)
    by_status = [{"status": row.code, "total": row.total} for row in (await db.execute(by_status_stmt))]

    by_priority_stmt = select(Ticket.priority, func.count().label("total")).group_by(Ticket.priority)
    if date_filter:
        by_priority_stmt = by_priority_stmt.where(*date_filter)
    by_priority = [{"priority": row.priority, "total": row.total} for row in (await db.execute(by_priority_stmt))]

    by_type_stmt = (
        select(Ticket.ticket_type, func.count().label("total"))
        .group_by(Ticket.ticket_type)
        .order_by(Ticket.ticket_type)
    )
    if date_filter:
        by_type_stmt = by_type_stmt.where(*date_filter)
    by_type = [{"ticket_type": row.ticket_type, "total": row.total} for row in (await db.execute(by_type_stmt))]

    # LEFT JOIN porque la clasificación es opcional; se agrupa por el
    # nombre real (no por el COALESCE) para que todos los NULL caigan en
    # un solo grupo "Sin clasificar".
    category_label = func.coalesce(TicketCategory.name, "Sin clasificar")
    by_category_stmt = (
        select(category_label.label("category"), func.count().label("total"))
        .select_from(Ticket)
        .outerjoin(TicketCategory, Ticket.category_id == TicketCategory.id)
        .group_by(TicketCategory.name)
        .order_by(func.count().desc())
    )
    if date_filter:
        by_category_stmt = by_category_stmt.where(*date_filter)
    by_category = [{"category": row.category, "total": row.total} for row in (await db.execute(by_category_stmt))]

    # Igual que category: assigned_area es opcional (se hereda del
    # solicitante solo si este ya tiene área asignada).
    area_label = func.coalesce(Area.name, "Sin área")
    by_area_stmt = (
        select(area_label.label("area"), func.count().label("total"))
        .select_from(Ticket)
        .outerjoin(Area, Ticket.assigned_area_id == Area.id)
        .group_by(Area.name)
        .order_by(func.count().desc())
    )
    if date_filter:
        by_area_stmt = by_area_stmt.where(*date_filter)
    by_area = [{"area": row.area, "total": row.total} for row in (await db.execute(by_area_stmt))]

    # resolved_at >= created_at descarta datos inconsistentes (p.ej.
    # resolved_at editado manualmente para pruebas) que arrastrarían el
    # promedio a negativo — a propósito, no es un bug.
    avg_stmt = (
        select(func.avg(func.extract("epoch", Ticket.resolved_at - Ticket.created_at) / 3600))
        .where(Ticket.resolved_at.is_not(None))
        .where(Ticket.resolved_at >= Ticket.created_at)
    )
    if date_filter:
        avg_stmt = avg_stmt.where(*date_filter)
    avg_resolution_hours = (await db.execute(avg_stmt)).scalar_one()

    # % resuelto el mismo día que se creó: métrica de la tarjeta destacada
    # del panel (mejora post-corte, 2026-08-26) — el promedio simple se
    # dejó de mostrar ahí porque un puñado de tickets reales que quedaron
    # meses abiertos (backlog real del histórico importado) lo arrastraban
    # a ~88h y generaba una alerta de gestión falsa, pese a que la mayoría
    # de los casos (>80%) se resuelven el mismo día — un promedio no es
    # robusto ante esos pocos valores extremos, el % de mismo día sí lo es.
    # Mismo filtro anti-inconsistencia y mismo `date_filter` que el
    # promedio, para que ambos números sigan siendo comparables entre sí.
    same_day_stmt = select(
        func.count().label("total"),
        func.count()
        .filter(cast(Ticket.resolved_at, Date) == cast(Ticket.created_at, Date))
        .label("same_day"),
    ).where(Ticket.resolved_at.is_not(None), Ticket.resolved_at >= Ticket.created_at)
    if date_filter:
        same_day_stmt = same_day_stmt.where(*date_filter)
    same_day_row = (await db.execute(same_day_stmt)).one()
    same_day_pct = (
        round(100 * same_day_row.same_day / same_day_row.total, 1) if same_day_row.total else None
    )

    return {
        "by_status": by_status,
        "by_priority": by_priority,
        "by_type": by_type,
        "by_category": by_category,
        "by_area": by_area,
        "avg_resolution_hours": float(avg_resolution_hours) if avg_resolution_hours is not None else None,
        "same_day_pct": same_day_pct,
    }


async def get_end_user_metrics(db: DbSession, requester_id: uuid.UUID) -> dict:
    """Vista del Usuario Final: todas sus solicitudes (el filtro a
    "activas", es decir `status.is_final == False`, se aplica en la ruta,
    igual que en el original React lo hacía en cliente sobre esta misma
    lista completa)."""
    stmt = select(Ticket).where(Ticket.requester_id == requester_id).order_by(Ticket.created_at.desc())
    tickets = list((await db.execute(stmt)).scalars().unique().all())
    return {"tickets": tickets}
