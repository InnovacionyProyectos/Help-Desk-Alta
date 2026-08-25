from fastapi import APIRouter, Request

from app.security.deps import CurrentUser
from app.templating import templates

router = APIRouter()


@router.get("/dashboard")
async def dashboard_page(request: Request, user: CurrentUser):
    return templates.TemplateResponse(
        request,
        "dashboard/placeholder.html",
        {"current_user": user, "active_nav": "dashboard"},
    )
