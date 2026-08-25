from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.config import settings
from app.database import get_db
from app.security.sessions import create_session, revoke_session
from app.services import auth_service
from app.services.auth_exceptions import (
    AccountInactiveError,
    AccountLockedError,
    InvalidCredentialsError,
)
from app.templating import templates

router = APIRouter()


@router.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse(request, "auth/login.html", {})


@router.post("/login")
async def login_submit(
    request: Request,
    db: Annotated[DbSession, Depends(get_db)],
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
):
    try:
        user = await auth_service.login(db, email, password)
    except InvalidCredentialsError:
        return templates.TemplateResponse(
            request,
            "auth/login.html",
            {"error": "Correo o contraseña incorrectos", "email": email},
            status_code=401,
        )
    except AccountLockedError as exc:
        hora = exc.locked_until.strftime("%H:%M")
        return templates.TemplateResponse(
            request,
            "auth/login.html",
            {"error": f"Cuenta bloqueada temporalmente. Intente nuevamente después de {hora}", "email": email},
            status_code=403,
        )
    except AccountInactiveError:
        return templates.TemplateResponse(
            request,
            "auth/login.html",
            {"error": "Cuenta desactivada. Contacte al administrador", "email": email},
            status_code=403,
        )

    token = await create_session(
        db,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    response = RedirectResponse(url="/dashboard", status_code=303)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_expires_hours * 3600,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )
    return response


@router.post("/logout")
async def logout(
    db: Annotated[DbSession, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
):
    if session_token:
        await revoke_session(db, session_token)
    response = RedirectResponse(url="/login", status_code=303)
    response.delete_cookie(settings.session_cookie_name)
    return response
