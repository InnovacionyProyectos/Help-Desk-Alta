import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.role import Role
from app.models.area import Area


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
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
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    deleted_at: Mapped[datetime | None]

    role: Mapped[Role] = relationship(lazy="joined")
    area: Mapped[Area | None] = relationship(lazy="joined")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
