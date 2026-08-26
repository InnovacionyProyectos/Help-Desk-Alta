"""Excel de tickets — equivalente al export con ExcelJS de
reports.service.ts. 13 columnas, encabezado en negrita, auto-filtro
A1:M1."""

import io

from openpyxl import Workbook
from openpyxl.styles import Font

from app.models.ticket import Ticket
from app.services.reports_service import PRIORITY_LABELS, STATUS_LABELS

COLUMNS = [
    "Ticket#",
    "Asunto",
    "Categoría",
    "Subcategoría",
    "Tipificación",
    "Prioridad",
    "Estado",
    "Solicitante",
    "Asignado a",
    "Área",
    "Creado",
    "Resuelto",
    "Cerrado",
]


def _fmt_date(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else ""


def build_tickets_excel(tickets: list[Ticket]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Tickets"

    ws.append(COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    ws.auto_filter.ref = "A1:M1"

    for t in tickets:
        ws.append(
            [
                t.ticket_number,
                t.subject,
                t.category.name if t.category else "",
                t.subcategory.name if t.subcategory else "",
                t.typification.name if t.typification else "",
                PRIORITY_LABELS.get(t.priority, t.priority),
                STATUS_LABELS.get(t.status.code, t.status.name),
                t.requester.full_name,
                t.assigned_to.full_name if t.assigned_to else "",
                t.assigned_area.name if t.assigned_area else "",
                _fmt_date(t.created_at),
                _fmt_date(t.resolved_at),
                _fmt_date(t.closed_at),
            ]
        )

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
