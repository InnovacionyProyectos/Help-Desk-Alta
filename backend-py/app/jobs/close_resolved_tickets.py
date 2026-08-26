"""Job de auto-cierre de tickets resueltos. Equivalente a
tickets.service.ts::autoCloseResolvedTickets del backend NestJS original
(allí decorado con @Cron(CronExpression.EVERY_10_MINUTES)). Aquí se registra
en el lifespan de app/main.py vía APScheduler, con el mismo intervalo.

A diferencia de ticket_service.change_status() (usada cuando un humano
cambia el estado), este job es un bypass directo sobre el modelo: NO crea
el comentario público de "Cambio de estado: ..." que change_status() sí
genera como efecto secundario. Omitirlo aquí es intencional, no un olvido
— el original tampoco lo hace para el cierre automático.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models.ticket import Ticket, TicketStatus, TicketStatusHistory
from app.services import audit_service

logger = logging.getLogger(__name__)

AUTO_CLOSE_REASON = "Cierre automático: 24 horas en estado Resuelto sin actividad"
AUTO_CLOSE_AFTER = timedelta(hours=24)


async def close_resolved_tickets() -> int:
    """Cierra automáticamente todo ticket RESOLVED cuyo `resolved_at` tenga
    24h o más de antigüedad. Abre su propia `AsyncSession` con `SessionLocal`
    (NO la dependencia `get_db`, pensada para el ciclo de vida de un request
    HTTP) porque esta función se invoca tanto desde el scheduler en background
    como manualmente (pruebas, scripts sueltos). Devuelve la cantidad de
    tickets cerrados, útil para logging y para verificación manual.

    El desfase de hasta 10 minutos frente a las 24h exactas (por el
    intervalo del scheduler) es aceptado a propósito, igual que en el
    original NestJS — no se compensa aquí.
    """
    cutoff = datetime.now(timezone.utc) - AUTO_CLOSE_AFTER

    async with SessionLocal() as db:
        resolved_status = (
            await db.execute(select(TicketStatus).where(TicketStatus.code == "RESOLVED"))
        ).scalar_one()
        closed_status = (
            await db.execute(select(TicketStatus).where(TicketStatus.code == "CLOSED"))
        ).scalar_one()

        result = await db.execute(
            select(Ticket).where(
                Ticket.status_id == resolved_status.id,
                Ticket.resolved_at <= cutoff,
            )
        )
        tickets = list(result.scalars().unique().all())

        now = datetime.now(timezone.utc)
        for ticket in tickets:
            ticket.status_id = closed_status.id
            ticket.closed_at = now

            db.add(
                TicketStatusHistory(
                    ticket_id=ticket.id,
                    from_status_id=resolved_status.id,
                    to_status_id=closed_status.id,
                    # NULL = "Sistema": el cierre no lo ejecuta ningún
                    # usuario, a diferencia de change_status().
                    changed_by=None,
                    reason=AUTO_CLOSE_REASON,
                )
            )

            await audit_service.record(
                db,
                user_id=None,
                action="CHANGE_STATUS",
                entity="Ticket",
                entity_id=str(ticket.id),
                old_values={"status": "RESOLVED"},
                new_values={"status": "CLOSED", "reason": AUTO_CLOSE_REASON},
            )

        if tickets:
            await db.commit()
            logger.info("Auto-cierre: %d ticket(s) pasados a CLOSED", len(tickets))

        return len(tickets)
