"""Ficha PDF de un ticket individual — equivalente al PDF generado con
pdfmake en reports.service.ts. Se construye con reportlab/Platypus en vez
de WeasyPrint: WeasyPrint requiere el runtime nativo de GTK3 (Pango/Cairo/
GDK-pixbuf) que no está disponible en este Windows sin un instalador aparte
(confirmado con un smoke test real: falla al cargar `libgobject-2.0-0`).
reportlab no tiene dependencias nativas, a cambio el layout se arma de
forma imperativa (Platypus flowables) en vez de HTML/CSS — decisión ya
prevista como plan B en el plan de migración."""

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.ticket import Ticket
from app.services.reports_service import PRIORITY_LABELS, STATUS_LABELS

PRIMARY = colors.HexColor("#0e4bf5")


def _fmt_date(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else "—"


def build_ticket_pdf(ticket: Ticket) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TicketTitle", parent=styles["Heading1"], textColor=PRIMARY, spaceAfter=4)
    subtitle_style = ParagraphStyle("TicketSubtitle", parent=styles["Normal"], textColor=colors.grey)
    body_style = ParagraphStyle("TicketBody", parent=styles["Normal"], spaceBefore=6, spaceAfter=6)

    story = [
        Paragraph(f"{ticket.ticket_number} · {ticket.subject}", title_style),
        Paragraph(
            f"{STATUS_LABELS.get(ticket.status.code, ticket.status.name)} · "
            f"Prioridad {PRIORITY_LABELS.get(ticket.priority, ticket.priority)}",
            subtitle_style,
        ),
        Spacer(1, 12),
        Paragraph("Descripción", styles["Heading3"]),
        Paragraph(ticket.description.replace("\n", "<br/>"), body_style),
        Spacer(1, 12),
    ]

    rows = [
        ["Categoría", ticket.category.name if ticket.category else "Sin clasificar"],
        ["Subcategoría", ticket.subcategory.name if ticket.subcategory else "—"],
        ["Tipificación", ticket.typification.name if ticket.typification else "—"],
        ["Solicitante", ticket.requester.full_name],
        ["Área", ticket.assigned_area.name if ticket.assigned_area else "Sin área"],
        ["Asignado a", ticket.assigned_to.full_name if ticket.assigned_to else "Sin asignar"],
        ["Creado", _fmt_date(ticket.created_at)],
        ["Resuelto", _fmt_date(ticket.resolved_at)],
        ["Cerrado", _fmt_date(ticket.closed_at)],
        ["Veces reabierto", str(ticket.reopened_count)],
    ]
    table = Table(rows, colWidths=[4 * cm, 11 * cm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#52514e")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#d8d8d8")),
            ]
        )
    )
    story.append(table)

    doc.build(story)
    return buffer.getvalue()
