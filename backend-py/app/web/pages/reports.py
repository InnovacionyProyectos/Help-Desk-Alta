"""Rutas de Reportes — equivalente a reports.controller.ts, donde TODO el
controller original es `@Roles('ADMIN')` a nivel de clase (incluida la
ficha PDF de un ticket individual). Se replica igual aquí con
`require_role("ADMIN")` en las 4 rutas — nota de paridad: el botón
"Descargar PDF" del detalle de ticket (tickets.py) es visible para
ADMIN/TECHNICIAN como en el React original, así que un TECHNICIAN que lo
usa recibe 403 del backend; es el comportamiento real del sistema
original, no un bug introducido en la reescritura."""

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
from app.services import reports_service, ticket_service
from app.services.reports_service import STATUS_LABELS
from app.services.ticket_exceptions import TicketNotFoundError
from app.templating import templates

router = APIRouter()

Db = Annotated[DbSession, Depends(get_db)]
AdminOnly = Annotated[object, Depends(require_role("ADMIN"))]

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
async def reports_page(request: Request, user: AdminOnly, db: Db):
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
    user: AdminOnly,
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
    user: AdminOnly,
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
async def download_ticket_pdf(ticket_id: uuid.UUID, user: AdminOnly, db: Db):
    try:
        ticket = await ticket_service.get_one(db, ticket_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    content = build_ticket_pdf(ticket)
    return Response(
        content=content,
        media_type=PDF_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{ticket.ticket_number}.pdf"'},
    )
