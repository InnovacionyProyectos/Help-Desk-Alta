import uuid
from datetime import datetime, timezone

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.role import Role
from app.models.area import Area


class User(Base):
    __tablename__ = "users"

    # default=uuid.uuid4 en Python (mismo patron que Session/Ticket): el id
    # de un User recien creado por el admin no se necesita antes del commit
    # (a diferencia de Ticket, que lo usa para historial en la misma unidad
    # de trabajo), pero SQLAlchemy no trata una PK UUID como
    # server-generada automaticamente sin esto (ver FlushError "NULL
    # identity key" — probado en vivo al construir Fase 8).
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # La columna real es CITEXT (case-insensitive) en Postgres; SQLAlchemy
    # la mapea como String porque la insensibilidad la aplica el propio tipo
    # de columna en la base, no hace falta un tipo especial en el ORM.
    email: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(30))
    role_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("roles.id"))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None]
    failed_login_attempts: Mapped[int] = mapped_column(SmallInteger, default=0)
    locked_until: Mapped[datetime | None]
    # server_default=now(): sin esto SQLAlchemy manda NULL explicito en el
    # INSERT en vez de dejar que la base aplique su propio DEFAULT now()
    # (mismo gotcha ya documentado en classification.py/ticket.py — este
    # modelo se quedo sin el fix desde la Fase 1 porque hasta la Fase 8
    # ningun INSERT de User pasaba por el ORM, siempre fueron datos ya
    # cargados/seed).
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None]

    role: Mapped[Role] = relationship(lazy="joined")
    area: Mapped[Area | None] = relationship(lazy="joined")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def is_locked(self) -> bool:
        """Bloqueado *ahora mismo* por intentos fallidos de login (ver
        auth_service.py: 5 intentos, 15 min). Calculado en el servidor —
        no basta con `locked_until IS NOT NULL`, porque el bloqueo ya
        pudo haber expirado por sí solo."""
        return self.locked_until is not None and self.locked_until > datetime.now(timezone.utc)
