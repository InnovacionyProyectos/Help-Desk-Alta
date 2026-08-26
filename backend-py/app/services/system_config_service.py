"""Config global minima (tabla singleton `system_config`, id=1). Solo cubre
lo que necesita attachments_service (limites de subida); ver comentario en
app/models/system_config.py sobre por que el resto de columnas no esta
mapeado todavia."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.models.system_config import SystemConfig


async def get_config(db: DbSession) -> SystemConfig:
    result = await db.execute(select(SystemConfig).where(SystemConfig.id == 1))
    config = result.scalar_one_or_none()
    if config is not None:
        return config

    # En staging la fila ya deberia existir (seed del DDL original), pero por
    # si el entorno no la tiene, se crea con los defaults del esquema real.
    config = SystemConfig(id=1)
    db.add(config)
    await db.commit()
    return config
