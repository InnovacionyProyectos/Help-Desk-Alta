from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.models.user import User
from app.security.passwords import verify_password
from app.services.auth_exceptions import (
    AccountInactiveError,
    AccountLockedError,
    InvalidCredentialsError,
)

# Mismos valores que AuthService.registerFailedAttempt en el backend NestJS
# original: al llegar a 5 intentos fallidos se bloquea 15 minutos, y el
# contador se resetea a 0 al bloquear (no sigue acumulando durante el bloqueo).
MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION_MINUTES = 15


async def _register_failed_attempt(db: DbSession, user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_DURATION_MINUTES)
        user.failed_login_attempts = 0
    await db.commit()


async def login(db: DbSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or user.deleted_at is not None:
        raise InvalidCredentialsError()

    now = datetime.now(timezone.utc)
    if user.locked_until is not None and user.locked_until > now:
        raise AccountLockedError(user.locked_until)

    if not user.is_active:
        raise AccountInactiveError()

    if not verify_password(user.password_hash, password):
        await _register_failed_attempt(db, user)
        raise InvalidCredentialsError()

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    await db.commit()
    return user
