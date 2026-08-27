"""Panel de perfil — mejora post-corte pedida explícitamente por el
usuario: "a cada usuario créale un panel de perfil, donde pueda cambiar la
contraseña". Disponible para los 3 roles (`CurrentUser`, sin `require_role`)
— a diferencia de `/admin/users/{id}/password`, que es Admin/Técnico
cambiándole la clave a OTRO usuario, esto es cada quien cambiando la suya
propia, con verificación de la contraseña actual."""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession as DbSessionType

from app.database import get_db
from app.schemas.user import SelfChangePasswordDto
from app.security.deps import CurrentUser
from app.services import user_service
from app.services.user_exceptions import IncorrectCurrentPasswordError
from app.templating import templates

router = APIRouter()

DbSession = Annotated[DbSessionType, Depends(get_db)]

ROLE_LABELS = {"ADMIN": "Administrador", "TECHNICIAN": "Técnico", "END_USER": "Usuario Final"}


@router.get("/profile")
async def profile_page(request: Request, user: CurrentUser, updated: Annotated[str | None, Query()] = None):
    return templates.TemplateResponse(
        request,
        "profile/index.html",
        {
            "current_user": user,
            "active_nav": "profile",
            "role_label": ROLE_LABELS.get(user.role.code, user.role.name),
            "error": None,
            "updated": updated == "1",
        },
    )


@router.post("/profile/password")
async def change_own_password_submit(
    request: Request,
    user: CurrentUser,
    db: DbSession,
    current_password: Annotated[str, Form()],
    new_password: Annotated[str, Form()],
    confirm_password: Annotated[str, Form()],
):
    if new_password != confirm_password:
        return templates.TemplateResponse(
            request,
            "profile/index.html",
            {
                "current_user": user,
                "active_nav": "profile",
                "role_label": ROLE_LABELS.get(user.role.code, user.role.name),
                "error": "La confirmación no coincide con la nueva contraseña",
                "updated": False,
            },
            status_code=400,
        )

    # dto = SelfChangePasswordDto(...) puede lanzar pydantic.ValidationError
    # si new_password no llega a 8 caracteres (bypass del minlength del
    # navegador) — se deja propagar al manejador genérico de excepciones no
    # capturadas de main.py, mismo patrón ya establecido en admin_users.py.
    dto = SelfChangePasswordDto(current_password=current_password, new_password=new_password)
    try:
        await user_service.change_own_password(db, user, dto)
    except IncorrectCurrentPasswordError as exc:
        return templates.TemplateResponse(
            request,
            "profile/index.html",
            {
                "current_user": user,
                "active_nav": "profile",
                "role_label": ROLE_LABELS.get(user.role.code, user.role.name),
                "error": str(exc),
                "updated": False,
            },
            status_code=400,
        )

    return RedirectResponse(url="/profile?updated=1", status_code=303)
