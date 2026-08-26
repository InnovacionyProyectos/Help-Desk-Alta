"""Resumen gerencial PDF — agrupado por estado y prioridad, promedio de
resolución (mismo filtro anti-inconsistencia que el dashboard), y tabla
detalle de los tickets del rango filtrado. Mismo motivo que pdf_ticket.py
para usar reportlab en vez de WeasyPrint (ver comentario ahí)."""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.ticket import Ticket
from app.services.reports_service import PRIORITY_LABELS, STATUS_LABELS

PRIMARY = colors.HexColor("#0e4bf5")
HEADER_BG = colors.HexColor("#f5f5f5")


def _fmt_date(dt) -> str:
    return dt.strftime("%Y-%m-%d") if dt else "—"


def _range_label(date_from: date | None, date_to: date | None) -> str:
    start = date_from.isoformat() if date_from else "inicio"
    end = date_to.isoformat() if date_to else "hoy"
    return f"{start} — {end}"


def build_summary_pdf(
    tickets: list[Ticket],
    summary: dict,
    date_from: date | None,
    date_to: date | None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("SummaryTitle", parent=styles["Heading1"], textColor=PRIMARY)
    subtitle_style = ParagraphStyle("SummarySubtitle", parent=styles["Normal"], textColor=colors.grey)

    story = [
        Paragraph("Resumen gerencial de tickets", title_style),
        Paragraph(f"Rango: {_range_label(date_from, date_to)}", subtitle_style),
        Spacer(1, 16),
    ]

    avg = summary["avg_resolution_hours"]
    avg_label = f"{avg:.1f} h" if avg is not None else "—"
    totals_table = Table(
        [["Total de tickets", str(summary["total"])], ["Tiempo prom. de resolución", avg_label]],
        colWidths=[6 * cm, 6 * cm],
    )
    totals_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), HEADER_BG),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(totals_table)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Distribución por estado", styles["Heading3"]))
    status_rows = [["Estado", "Total"]] + [
        [STATUS_LABELS.get(code, code), str(total)] for code, total in summary["by_status"].items()
    ]
    story.append(_styled_table(status_rows))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Distribución por prioridad", styles["Heading3"]))
    priority_rows = [["Prioridad", "Total"]] + [
        [PRIORITY_LABELS.get(code, code), str(total)] for code, total in summary["by_priority"].items()
    ]
    story.append(_styled_table(priority_rows))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Detalle de tickets", styles["Heading3"]))
    detail_rows = [["Ticket#", "Asunto", "Estado", "Prioridad", "Solicitante", "Creado"]]
    for t in tickets:
        detail_rows.append(
            [
                t.ticket_number,
                t.subject[:40] + ("…" if len(t.subject) > 40 else ""),
                STATUS_LABELS.get(t.status.code, t.status.name),
                PRIORITY_LABELS.get(t.priority, t.priority),
                t.requester.full_name,
                _fmt_date(t.created_at),
            ]
        )
    story.append(_styled_table(detail_rows, col_widths=[2.3 * cm, 5 * cm, 2.3 * cm, 2.2 * cm, 3.2 * cm, 2 * cm]))

    doc.build(story)
    return buffer.getvalue()


def _styled_table(rows: list[list[str]], col_widths=None) -> Table:
    table = Table(rows, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d8d8d8")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HEADER_BG]),
            ]
        )
    )
    return table
