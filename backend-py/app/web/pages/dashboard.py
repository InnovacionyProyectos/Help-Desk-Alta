"""Página `/dashboard` — misma ruta para los 3 roles, cada uno ve una
vista distinta según `current_user.role.code` (equivalente combinado de
dashboard.controller.ts + DashboardPage.tsx/AdminDashboard.tsx/
TechnicianDashboard.tsx/EndUserDashboard.tsx del frontend React original)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.charts.horizontal_bar import build_horizontal_bar
from app.charts.segmented_meter import build_segmented_meter
from app.charts.treemap import HEIGHT as TREEMAP_HEIGHT
from app.charts.treemap import build_treemap
from app.charts.waffle import build_waffle
from app.database import get_db
from app.models.user import User
from app.security.deps import CurrentUser
from app.services import dashboard_service
from app.templating import templates

router = APIRouter()

Db = Annotated[DbSession, Depends(get_db)]

# Mismas etiquetas que tickets.py (TYPE_LABELS/PRIORITY_LABELS) más las de
# estado, que tickets.py no necesitaba tener centralizadas porque siempre
# renderizaba el nombre ya traducido desde `ticket_statuses.name` en BD.
STATUS_LABELS = {
    "OPEN": "Abierto",
    "ASSIGNED": "Asignado",
    "IN_PROGRESS": "En progreso",
    "ON_HOLD": "En espera",
    "RESOLVED": "Resuelto",
    "CLOSED": "Cerrado",
    "REOPENED": "Reabierto",
}
TYPE_LABELS = {"INCIDENTE": "Incidente", "REQUERIMIENTO": "Requerimiento", "CONSULTA": "Consulta"}
PRIORITY_LABELS = {"LOW": "Baja", "MEDIUM": "Media", "HIGH": "Alta", "CRITICAL": "Crítica"}

# Mismos colores que StatusBadge/TicketTypeBadge (var(--status-*)/
# var(--type-*) en app.css) para que la identidad visual sea consistente
# entre el gráfico y las etiquetas que se ven en el detalle/listado de
# tickets — puerto literal de las constantes en AdminDashboard.tsx.
STATUS_COLORS = {
    "OPEN": "var(--status-open)",
    "ASSIGNED": "var(--status-assigned)",
    "IN_PROGRESS": "var(--status-in_progress)",
    "ON_HOLD": "var(--status-on_hold)",
    "RESOLVED": "var(--status-resolved)",
    "CLOSED": "var(--status-closed)",
    "REOPENED": "var(--status-reopened)",
}
TYPE_COLORS = {
    "INCIDENTE": "var(--type-incidente)",
    "REQUERIMIENTO": "var(--type-requerimiento)",
    "CONSULTA": "var(--type-consulta)",
}
# Paleta categórica de 8 tonos para el treemap de Categoría, cuyos nombres
# son dinámicos y no tienen un color semántico propio como sí lo tienen
# estado/tipo — misma paleta fija que CATEGORY_COLORS en AdminDashboard.tsx.
CATEGORY_COLORS = ["#0e4bf5", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]


@router.get("/dashboard")
async def dashboard_page(
    request: Request,
    user: CurrentUser,
    db: Db,
    month: Annotated[str | None, Query()] = None,
):
    role = user.role.code
    # Técnico ve el mismo panel que Admin (mismos permisos salvo
    # Clasificación, que sigue siendo exclusiva de Admin — ver
    # admin_classification.py/admin_users.py). Solo Usuario Final tiene
    # una vista propia (sus solicitudes activas).
    if role in ("ADMIN", "TECHNICIAN"):
        # month llega como "YYYY-MM" desde <input type="month"> o vacío/
        # ausente ("Ver todo").
        return await _admin_dashboard(request, user, db, month=month or None)
    return await _end_user_dashboard(request, user, db)


async def _admin_dashboard(request: Request, user: User, db: Db, month: str | None = None):
    metrics = await dashboard_service.get_admin_metrics(db, month=month)

    total_tickets = sum(item["total"] for item in metrics["by_status"])
    avg_hours = (
        f"{metrics['avg_resolution_hours']:.1f}" if metrics["avg_resolution_hours"] is not None else "—"
    )
    highlight_cards = [
        {"label": STATUS_LABELS[item["status"]], "value": item["total"]}
        for item in metrics["by_status"]
        if item["status"] in ("OPEN", "IN_PROGRESS")
    ]

    by_area_chart = build_horizontal_bar(
        [{"label": item["area"], "value": item["total"]} for item in metrics["by_area"]],
        "var(--color-primary)",
    )
    by_type_chart = build_waffle(
        [
            {
                "label": TYPE_LABELS[item["ticket_type"]],
                "value": item["total"],
                "color": TYPE_COLORS[item["ticket_type"]],
            }
            for item in metrics["by_type"]
        ]
    )
    by_status_chart = build_segmented_meter(
        [
            {
                "label": STATUS_LABELS[item["status"]],
                "value": item["total"],
                "color": STATUS_COLORS[item["status"]],
            }
            for item in metrics["by_status"]
        ]
    )
    by_category_chart = build_treemap(
        [
            {
                "label": item["category"],
                "value": item["total"],
                "color": CATEGORY_COLORS[i % len(CATEGORY_COLORS)],
            }
            for i, item in enumerate(metrics["by_category"])
        ]
    )

    return templates.TemplateResponse(
        request,
        "dashboard/admin.html",
        {
            "current_user": user,
            "active_nav": "dashboard",
            "total_tickets": total_tickets,
            "avg_hours": avg_hours,
            "highlight_cards": highlight_cards,
            "by_area_chart": by_area_chart,
            "by_type_chart": by_type_chart,
            "by_status_chart": by_status_chart,
            "by_category_chart": by_category_chart,
            "treemap_height": TREEMAP_HEIGHT,
            "month": month or "",
        },
    )


async def _end_user_dashboard(request: Request, user: User, db: Db):
    metrics = await dashboard_service.get_end_user_metrics(db, user.id)
    # El React original filtraba en cliente (`tickets.filter(t =>
    # !t.status.isFinal)`); aquí se hace en la ruta sobre la lista completa
    # que devuelve el servicio, como pide la Fase 6.
    active_tickets = [t for t in metrics["tickets"] if not t.status.is_final]
    return templates.TemplateResponse(
        request,
        "dashboard/end_user.html",
        {
            "current_user": user,
            "active_nav": "dashboard",
            "active_tickets": active_tickets,
            "priority_labels": PRIORITY_LABELS,
        },
    )
