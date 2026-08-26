"""Rutas de Reportes. El NestJS original tenía TODO el controller en
`@Roles('ADMIN')` a nivel de clase (incluida la ficha PDF de un ticket
individual) — desviación deliberada de esa paridad: por pedido explícito
del usuario, Técnico ahora tiene los mismos permisos que Admin excepto
Clasificación, así que las 4 rutas de Reportes son ADMIN+TECHNICIAN aquí
(antes eran ADMIN-only, y antes de eso un TECHNICIAN recibía 403 al usar
el botón "Descargar PDF" del detalle de ticket pese a que el botón le era
visible — esa inconsistencia ya no existe)."""

import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.database import get_db
from app.exports.excel_tickets import build_tickets_excel
from app.exports.pdf_summary import build_summary_pdf
from app.exports.pdf_ticket import build_ticket_pdf
from app.models.area import Area
from app.models.ticket import TicketStatus
from app.security.deps import require_role
from app.services import attachments_service, reports_service, ticket_service
from app.services.reports_service import STATUS_LABELS
from app.services.ticket_exceptions import TicketNotFoundError
from app.templating import templates

router = APIRouter()

Db = Annotated[DbSession, Depends(get_db)]
StaffOnly = Annotated[object, Depends(require_role("ADMIN", "TECHNICIAN"))]

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_MEDIA_TYPE = "application/pdf"


def _parse_filters(date_from: str, date_to: str, status: str, area_id: str):
    """Los filtros llegan como query string de un <form method="get"> con
    <input type="date">/<select> que SIEMPRE mandan el campo (vacío si no
    se eligió nada) — a diferencia de un DTO JSON donde "ausente" y "vacío"
    son la misma cosa, aquí hay que aceptar el string vacío explícitamente
    y convertirlo a None a mano; declararlos como `date|int` directo en la
    firma de FastAPI rechazaría con 422 apenas llega "" en vez de dejar
    pasar la solicitud sin ese filtro."""
    parsed_from = date.fromisoformat(date_from) if date_from else None
    parsed_to = date.fromisoformat(date_to) if date_to else None
    parsed_status = status or None
    parsed_area_id = int(area_id) if area_id else None
    return parsed_from, parsed_to, parsed_status, parsed_area_id


@router.get("/reports")
async def reports_page(request: Request, user: StaffOnly, db: Db):
    statuses = list((await db.execute(select(TicketStatus).order_by(TicketStatus.display_order))).scalars())
    areas = list((await db.execute(select(Area).order_by(Area.name))).scalars())
    return templates.TemplateResponse(
        request,
        "reports/index.html",
        {
            "current_user": user,
            "active_nav": "reports",
            "statuses": statuses,
            "areas": areas,
            "status_labels": STATUS_LABELS,
        },
    )


@router.get("/reports/tickets.xlsx")
async def download_excel(
    user: StaffOnly,
    db: Db,
    date_from: Annotated[str, Query()] = "",
    date_to: Annotated[str, Query()] = "",
    status: Annotated[str, Query()] = "",
    area_id: Annotated[str, Query()] = "",
):
    parsed_from, parsed_to, parsed_status, parsed_area_id = _parse_filters(date_from, date_to, status, area_id)
    tickets = await reports_service.query_tickets(db, parsed_from, parsed_to, parsed_status, parsed_area_id)
    content = build_tickets_excel(tickets)
    filename = f"tickets-{datetime.now():%Y-%m-%d}.xlsx"
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/summary.pdf")
async def download_summary_pdf(
    user: StaffOnly,
    db: Db,
    date_from: Annotated[str, Query()] = "",
    date_to: Annotated[str, Query()] = "",
    status: Annotated[str, Query()] = "",
    area_id: Annotated[str, Query()] = "",
):
    parsed_from, parsed_to, parsed_status, parsed_area_id = _parse_filters(date_from, date_to, status, area_id)
    tickets = await reports_service.query_tickets(db, parsed_from, parsed_to, parsed_status, parsed_area_id)
    summary = reports_service.summarize(tickets)
    content = build_summary_pdf(tickets, summary, parsed_from, parsed_to)
    return Response(
        content=content,
        media_type=PDF_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="resumen-gerencial.pdf"'},
    )


@router.get("/reports/tickets/{ticket_id}/pdf")
async def download_ticket_pdf(ticket_id: uuid.UUID, user: StaffOnly, db: Db):
    """`actor=user` en las 3 llamadas: no es solo para el chequeo de
    propiedad (irrelevante aquí, ADMIN/TECHNICIAN siempre pasan), sino
    para que `list_comments` incluya los comentarios internos — el pedido
    explícito del usuario es que el PDF sirva como respaldo completo de
    auditoría, y Admin/Técnico ya ven esos comentarios en la pantalla."""
    try:
        ticket = await ticket_service.get_one(db, ticket_id, actor=user)
        history = await ticket_service.get_history(db, ticket_id, actor=user)
        comments = await ticket_service.list_comments(db, ticket_id, actor=user)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    attachments = await attachments_service.list_by_ticket(db, ticket_id, user)

    content = build_ticket_pdf(ticket, history, comments, attachments)
    return Response(
        content=content,
        media_type=PDF_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{ticket.ticket_number}.pdf"'},
    )
