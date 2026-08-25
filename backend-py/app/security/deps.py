from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.security.exceptions import ForbiddenException, NotAuthenticatedException
from app.security.sessions import get_user_for_token


async def get_current_user(
    db: Annotated[DbSession, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> User:
    if session_token is None:
        raise NotAuthenticatedException()
    user = await get_user_for_token(db, session_token)
    if user is None:
        raise NotAuthenticatedException()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*role_codes: str):
    """Equivalente al decorador @Roles(...) + RolesGuard de NestJS: sin
    argumentos, cualquier usuario autenticado pasa; con roles, exige que
    el rol del usuario este en la lista o lanza 403."""

    async def _dep(user: CurrentUser) -> User:
        if role_codes and user.role.code not in role_codes:
            raise ForbiddenException()
        return user

    return _dep
