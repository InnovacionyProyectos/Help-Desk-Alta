import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.config import settings
from app.models.session import Session
from app.models.user import User


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(db: DbSession, user: User, user_agent: str | None, ip_address: str | None) -> str:
    """Crea una sesion nueva y devuelve el token en texto plano (para la
    cookie); en la base solo se guarda su hash, igual que el patron de
    `refresh_tokens` original."""
    token = secrets.token_urlsafe(48)
    session = Session(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=_hash_token(token),
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.session_expires_hours),
        created_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    return token


async def get_user_for_token(db: DbSession, token: str) -> User | None:
    """Resuelve el usuario de una sesion vigente y **reconsulta el usuario
    en base de datos** (no solo la sesion) para reflejar de inmediato
    bloqueos/desactivacion/cambio de rol, igual que hacia la JwtStrategy
    original."""
    token_hash = _hash_token(token)
    result = await db.execute(select(Session).where(Session.token_hash == token_hash))
    session = result.scalar_one_or_none()
    if session is None or session.revoked_at is not None:
        return None
    if session.expires_at < datetime.now(timezone.utc):
        return None

    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active or user.deleted_at is not None:
        return None
    return user


async def revoke_session(db: DbSession, token: str) -> None:
    token_hash = _hash_token(token)
    result = await db.execute(select(Session).where(Session.token_hash == token_hash))
    session = result.scalar_one_or_none()
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()
