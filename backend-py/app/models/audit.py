import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import TIMESTAMP, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    """Bitácora mínima (`record()` en app/services/audit_service.py) para
    las acciones críticas de Tickets (CHANGE_STATUS, ASSIGN). El interceptor
    genérico que audita todo automáticamente queda para Fase 9."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    # NULL = accion del sistema (ej. auto-cierre de Fase 4).
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    # CHECK (action IN ('CREATE','UPDATE','DELETE','CHANGE_STATUS','LOGIN','LOGOUT','ASSIGN')) en el DDL.
    action: Mapped[str] = mapped_column(String(20))
    entity: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str] = mapped_column(String(60))
    old_values: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    new_values: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
