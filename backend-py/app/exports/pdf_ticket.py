"""Ficha PDF de un ticket individual — equivalente al PDF generado con
pdfmake en reports.service.ts. Se construye con reportlab/Platypus en vez
de WeasyPrint: WeasyPrint requiere el runtime nativo de GTK3 (Pango/Cairo/
GDK-pixbuf) que no está disponible en este Windows sin un instalador aparte
(confirmado con un smoke test real: falla al cargar `libgobject-2.0-0`).
reportlab no tiene dependencias nativas, a cambio el layout se arma de
forma imperativa (Platypus flowables) en vez de HTML/CSS — decisión ya
prevista como plan B en el plan de migración.

Pedido explícito del usuario: el PDF debe traer el ticket COMPLETO —
historial de estado/asignación, comentarios (incluidos los internos, ya
que solo Admin/Técnico llegan a esta ruta) y adjuntos — para poder usarse
como respaldo en auditoría o sustentación de un caso, no solo los datos
básicos que traía antes."""

import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.exports.fonts import register_fonts
from app.models.attachment import TicketAttachment
from app.models.ticket import Ticket, TicketComment
from app.services.reports_service import PRIORITY_LABELS, STATUS_LABELS

PRIMARY = colors.HexColor("#0e4bf5")
MUTED = colors.HexColor("#52514e")
RULE = colors.HexColor("#d8d8d8")

_CELL_STYLE = ParagraphStyle("TableCell", fontName="DMSans", fontSize=8, leading=11)


def _fmt_date(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else "—"


def _fmt_size(size_bytes: int) -> str:
    size = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def _cell(value: str) -> Paragraph:
    """Celdas envueltas en Paragraph, no texto plano: una celda de Table
    con un string crudo NO hace saltos de línea automáticos en reportlab —
    el texto largo (nombres/motivos) simplemente se sale de su columna y
    queda encima de la columna siguiente, confirmado en vivo (captura del
    usuario: "Por" superpuesto con "Motivo"). Paragraph sí respeta el ancho
    de columna y hace wrap."""
    return Paragraph(escape(str(value)), _CELL_STYLE)


def _section_table(rows: list[list[str]], col_widths: list[float]) -> Table:
    """`rows[0]` es el encabezado (texto plano, corto, no necesita wrap);
    el resto se envuelve celda por celda con `_cell()`."""
    wrapped = [rows[0]] + [[_cell(value) for value in row] for row in rows[1:]]
    table = Table(wrapped, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "DMSans-Bold"),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def build_ticket_pdf(
    ticket: Ticket,
    history: list[dict],
    comments: list[TicketComment],
    attachments: list[TicketAttachment],
) -> bytes:
    register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    # Tipografía de marca: DM Sans en vez del Helvetica por defecto de
    # reportlab (ver app/exports/fonts.py) — se sobreescribe sobre los
    # estilos base para que todos los ParagraphStyle que heredan de estos
    # (title_style, subtitle_style, body_style, etc. más abajo) tomen la
    # fuente correcta sin repetirla en cada uno.
    styles["Normal"].fontName = "DMSans"
    styles["Heading1"].fontName = "DMSans-Bold"
    styles["Heading3"].fontName = "DMSans-Bold"
    title_style = ParagraphStyle("TicketTitle", parent=styles["Heading1"], textColor=PRIMARY, spaceAfter=4)
    subtitle_style = ParagraphStyle("TicketSubtitle", parent=styles["Normal"], textColor=colors.grey)
    section_style = ParagraphStyle("TicketSection", parent=styles["Heading3"], spaceBefore=16, spaceAfter=6)
    body_style = ParagraphStyle("TicketBody", parent=styles["Normal"], spaceBefore=6, spaceAfter=6)
    comment_meta_style = ParagraphStyle("CommentMeta", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
    comment_body_style = ParagraphStyle("CommentBody", parent=styles["Normal"], spaceBefore=2, spaceAfter=10)
    empty_style = ParagraphStyle("Empty", parent=styles["Normal"], textColor=colors.grey, spaceAfter=10)

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

    detail_rows = [
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
    # Valor envuelto en Paragraph (ver _cell()) — un nombre de categoría o
    # de usuario largo no tiene con qué desbordarse hacia una columna que
    # no existe, pero sí puede salirse del margen de la página sin wrap.
    detail_table = Table(
        [[key, _cell(value)] for key, value in detail_rows],
        colWidths=[4 * cm, 12.5 * cm],
    )
    detail_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "DMSans-Bold"),
                ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
                ("FONTSIZE", (0, 0), (0, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(detail_table)

    # ---------- Historial (estado + asignación, línea de tiempo combinada) ----------
    story.append(Paragraph("Historial", section_style))
    if not history:
        story.append(Paragraph("Sin eventos de historial.", empty_style))
    else:
        rows = [["Fecha", "Evento", "Detalle", "Por", "Motivo"]]
        for event in history:
            if event["type"] == "STATUS_CHANGE":
                detalle = f"{event['from'] or '—'} → {event['to']}"
                tipo = "Cambio de estado"
            else:
                detalle = f"{event['from'] or 'Sin asignar'} → {event['to']}"
                tipo = "Reasignación"
            rows.append(
                [
                    _fmt_date(event["created_at"]),
                    tipo,
                    detalle,
                    event["by"],
                    event["reason"] or "—",
                ]
            )
        story.append(_section_table(rows, [2.3 * cm, 2.1 * cm, 3.4 * cm, 2.7 * cm, 6 * cm]))

    # ---------- Comentarios (incluye internos: esta ruta es solo Admin/Técnico) ----------
    story.append(Paragraph("Comentarios", section_style))
    if not comments:
        story.append(Paragraph("Sin comentarios.", empty_style))
    else:
        for comment in comments:
            tag = " · [Interno]" if comment.is_internal else ""
            story.append(
                Paragraph(
                    f"{comment.author.full_name} — {_fmt_date(comment.created_at)}{tag}",
                    comment_meta_style,
                )
            )
            story.append(Paragraph(comment.body.replace("\n", "<br/>"), comment_body_style))

    # ---------- Adjuntos ----------
    story.append(Paragraph("Adjuntos", section_style))
    if not attachments:
        story.append(Paragraph("Sin adjuntos.", empty_style))
    else:
        rows = [["Archivo", "Tamaño", "Subido por", "Fecha"]]
        for attachment in attachments:
            rows.append(
                [
                    attachment.file_name,
                    _fmt_size(attachment.size_bytes),
                    attachment.uploaded_by_user.full_name,
                    _fmt_date(attachment.created_at),
                ]
            )
        story.append(_section_table(rows, [7 * cm, 2 * cm, 4.5 * cm, 3 * cm]))

    doc.build(story)
    return buffer.getvalue()
