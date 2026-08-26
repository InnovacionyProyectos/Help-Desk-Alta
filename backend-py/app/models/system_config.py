from sqlalchemy import Integer, SmallInteger, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SystemConfig(Base):
    """Tabla singleton (una sola fila, id=1) de configuración global del
    sistema. Solo se mapean las columnas que necesita Fase 5 (límites de
    adjuntos); el resto del esquema real (SMTP, logo, horario de negocio,
    prefijo de ticket, etc.) se deja sin mapear hasta que haga falta un
    módulo de Admin > Configuración — SQLAlchemy solo lee/escribe las
    columnas declaradas aquí, así que omitir el resto es seguro tanto para
    SELECT como para el INSERT de respaldo en get_config() (las columnas NOT
    NULL no mapeadas caen en su DEFAULT de la base)."""

    __tablename__ = "system_config"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    max_attachment_size_mb: Mapped[int] = mapped_column(Integer, default=10)
    allowed_extensions: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=lambda: ["pdf", "jpg", "jpeg", "png", "docx", "xlsx", "txt"]
    )
