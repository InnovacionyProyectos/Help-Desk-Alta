from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession
from sqlalchemy.orm import selectinload

from app.models.classification import TicketCategory, TicketSubcategory, TicketTypification
from app.schemas.classification import CategoryOption, SubcategoryOption, TypificationOption
from app.services.classification_exceptions import (
    CategoryNotFoundError,
    InvalidClassificationChainError,
    SubcategoryNotFoundError,
    TypificationNotFoundError,
)

# ===================================================================
# CASCADA (consumida por el formulario de creación de tickets)
# ===================================================================


async def get_cascade(db: DbSession) -> list[CategoryOption]:
    """Árbol completo Categoría -> Subcategoría -> Tipificación, filtrando
    solo elementos activos, listo para poblar los 3 <select> encadenados
    del frontend en una sola llamada."""
    result = await db.execute(
        select(TicketCategory)
        .where(TicketCategory.is_active.is_(True))
        .options(selectinload(TicketCategory.subcategories).selectinload(TicketSubcategory.typifications))
        .order_by(TicketCategory.display_order, TicketCategory.name)
    )
    categories = result.scalars().unique().all()

    return [
        CategoryOption(
            id=category.id,
            name=category.name,
            subcategories=[
                SubcategoryOption(
                    id=sub.id,
                    name=sub.name,
                    typifications=[
                        TypificationOption(id=typ.id, name=typ.name, default_priority=typ.default_priority)
                        for typ in sub.typifications
                        if typ.is_active
                    ],
                )
                for sub in category.subcategories
                if sub.is_active
            ],
        )
        for category in categories
    ]


async def get_admin_tree(db: DbSession) -> list[TicketCategory]:
    """Árbol completo SIN filtrar por is_active, para la pantalla de
    administración: el Admin necesita ver también los elementos
    desactivados para poder reactivarlos."""
    result = await db.execute(
        select(TicketCategory)
        .options(selectinload(TicketCategory.subcategories).selectinload(TicketSubcategory.typifications))
        .order_by(TicketCategory.display_order, TicketCategory.name)
    )
    return list(result.scalars().unique().all())


async def get_subcategories_by_category(db: DbSession, category_id: int) -> list[TicketSubcategory]:
    """Segundo nivel: subcategorías activas de una categoría (carga bajo demanda)."""
    await get_category_or_fail(db, category_id)
    result = await db.execute(
        select(TicketSubcategory)
        .where(TicketSubcategory.category_id == category_id, TicketSubcategory.is_active.is_(True))
        .order_by(TicketSubcategory.display_order, TicketSubcategory.name)
    )
    return list(result.scalars().all())


async def get_typifications_by_subcategory(db: DbSession, subcategory_id: int) -> list[TicketTypification]:
    """Tercer nivel: tipificaciones activas de una subcategoría (carga bajo demanda)."""
    await get_subcategory_or_fail(db, subcategory_id)
    result = await db.execute(
        select(TicketTypification)
        .where(TicketTypification.subcategory_id == subcategory_id, TicketTypification.is_active.is_(True))
        .order_by(TicketTypification.display_order, TicketTypification.name)
    )
    return list(result.scalars().all())


async def validate_chain(
    db: DbSession, category_id: int, subcategory_id: int, typification_id: int
) -> TicketTypification:
    """Valida que category -> subcategory -> typification formen una cadena
    jerárquica válida y activa. Se usa al crear/editar un ticket para evitar
    combinaciones inconsistentes (ej. tipificación de otra rama)."""
    result = await db.execute(
        select(TicketTypification)
        .where(TicketTypification.id == typification_id, TicketTypification.is_active.is_(True))
        .options(selectinload(TicketTypification.subcategory).selectinload(TicketSubcategory.category))
    )
    typification = result.scalar_one_or_none()

    if (
        typification is None
        or typification.subcategory.id != subcategory_id
        or typification.subcategory.category.id != category_id
        or not typification.subcategory.is_active
        or not typification.subcategory.category.is_active
    ):
        raise InvalidClassificationChainError()

    return typification


# ===================================================================
# CRUD ADMINISTRATIVO — Categorías
# ===================================================================


async def get_category_or_fail(db: DbSession, category_id: int) -> TicketCategory:
    category = await db.get(TicketCategory, category_id)
    if category is None:
        raise CategoryNotFoundError(category_id)
    return category


async def get_category_node(db: DbSession, category_id: int) -> TicketCategory:
    """Categoría con subcategorías/tipificaciones cargadas, para renderizar
    el fragmento `.tree-node` completo tras crear/editar/activar-desactivar."""
    result = await db.execute(
        select(TicketCategory)
        .where(TicketCategory.id == category_id)
        .options(selectinload(TicketCategory.subcategories).selectinload(TicketSubcategory.typifications))
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise CategoryNotFoundError(category_id)
    return category


async def list_categories(db: DbSession) -> list[TicketCategory]:
    result = await db.execute(
        select(TicketCategory).order_by(TicketCategory.display_order, TicketCategory.name)
    )
    return list(result.scalars().all())


async def create_category(
    db: DbSession,
    *,
    name: str,
    code: str | None = None,
    description: str | None = None,
    display_order: int = 0,
) -> TicketCategory:
    category = TicketCategory(name=name, code=code, description=description, display_order=display_order)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def update_category(
    db: DbSession,
    category_id: int,
    *,
    name: str | None = None,
    code: str | None = None,
    description: str | None = None,
    display_order: int | None = None,
    is_active: bool | None = None,
) -> TicketCategory:
    category = await get_category_or_fail(db, category_id)
    if name is not None:
        category.name = name
    if code is not None:
        category.code = code
    if description is not None:
        category.description = description
    if display_order is not None:
        category.display_order = display_order
    if is_active is not None:
        category.is_active = is_active
    await db.commit()
    await db.refresh(category)
    return category


async def toggle_category_active(db: DbSession, category_id: int) -> TicketCategory:
    category = await get_category_or_fail(db, category_id)
    category.is_active = not category.is_active
    await db.commit()
    return await get_category_node(db, category_id)


# ===================================================================
# CRUD ADMINISTRATIVO — Subcategorías
# ===================================================================


async def get_subcategory_or_fail(db: DbSession, subcategory_id: int) -> TicketSubcategory:
    result = await db.execute(
        select(TicketSubcategory)
        .where(TicketSubcategory.id == subcategory_id)
        .options(selectinload(TicketSubcategory.category))
    )
    subcategory = result.scalar_one_or_none()
    if subcategory is None:
        raise SubcategoryNotFoundError(subcategory_id)
    return subcategory


async def get_subcategory_node(db: DbSession, subcategory_id: int) -> TicketSubcategory:
    """Subcategoría con tipificaciones cargadas, para renderizar el
    fragmento `.tree-node` tras crear/editar/activar-desactivar."""
    result = await db.execute(
        select(TicketSubcategory)
        .where(TicketSubcategory.id == subcategory_id)
        .options(selectinload(TicketSubcategory.typifications))
    )
    subcategory = result.scalar_one_or_none()
    if subcategory is None:
        raise SubcategoryNotFoundError(subcategory_id)
    return subcategory


async def create_subcategory(
    db: DbSession,
    *,
    category_id: int,
    name: str,
    code: str | None = None,
    description: str | None = None,
    display_order: int = 0,
) -> TicketSubcategory:
    await get_category_or_fail(db, category_id)
    subcategory = TicketSubcategory(
        category_id=category_id,
        name=name,
        code=code,
        description=description,
        display_order=display_order,
    )
    db.add(subcategory)
    await db.commit()
    await db.refresh(subcategory)
    return subcategory


async def update_subcategory(
    db: DbSession,
    subcategory_id: int,
    *,
    category_id: int | None = None,
    name: str | None = None,
    code: str | None = None,
    description: str | None = None,
    display_order: int | None = None,
    is_active: bool | None = None,
) -> TicketSubcategory:
    subcategory = await get_subcategory_or_fail(db, subcategory_id)
    if category_id is not None:
        await get_category_or_fail(db, category_id)
        subcategory.category_id = category_id
    if name is not None:
        subcategory.name = name
    if code is not None:
        subcategory.code = code
    if description is not None:
        subcategory.description = description
    if display_order is not None:
        subcategory.display_order = display_order
    if is_active is not None:
        subcategory.is_active = is_active
    await db.commit()
    await db.refresh(subcategory)
    return subcategory


async def toggle_subcategory_active(db: DbSession, subcategory_id: int) -> TicketSubcategory:
    subcategory = await get_subcategory_or_fail(db, subcategory_id)
    subcategory.is_active = not subcategory.is_active
    await db.commit()
    return await get_subcategory_node(db, subcategory_id)


# ===================================================================
# CRUD ADMINISTRATIVO — Tipificaciones
# ===================================================================


async def get_typification_or_fail(db: DbSession, typification_id: int) -> TicketTypification:
    result = await db.execute(
        select(TicketTypification)
        .where(TicketTypification.id == typification_id)
        .options(selectinload(TicketTypification.subcategory))
    )
    typification = result.scalar_one_or_none()
    if typification is None:
        raise TypificationNotFoundError(typification_id)
    return typification


async def create_typification(
    db: DbSession,
    *,
    subcategory_id: int,
    name: str,
    code: str | None = None,
    description: str | None = None,
    display_order: int = 0,
    default_priority: str = "MEDIUM",
) -> TicketTypification:
    await get_subcategory_or_fail(db, subcategory_id)
    typification = TicketTypification(
        subcategory_id=subcategory_id,
        name=name,
        code=code,
        description=description,
        display_order=display_order,
        default_priority=default_priority,
    )
    db.add(typification)
    await db.commit()
    await db.refresh(typification)
    return typification


async def update_typification(
    db: DbSession,
    typification_id: int,
    *,
    subcategory_id: int | None = None,
    name: str | None = None,
    code: str | None = None,
    description: str | None = None,
    display_order: int | None = None,
    default_priority: str | None = None,
    is_active: bool | None = None,
) -> TicketTypification:
    typification = await get_typification_or_fail(db, typification_id)
    if subcategory_id is not None:
        await get_subcategory_or_fail(db, subcategory_id)
        typification.subcategory_id = subcategory_id
    if name is not None:
        typification.name = name
    if code is not None:
        typification.code = code
    if description is not None:
        typification.description = description
    if display_order is not None:
        typification.display_order = display_order
    if default_priority is not None:
        typification.default_priority = default_priority
    if is_active is not None:
        typification.is_active = is_active
    await db.commit()
    await db.refresh(typification)
    return typification


async def toggle_typification_active(db: DbSession, typification_id: int) -> TicketTypification:
    typification = await get_typification_or_fail(db, typification_id)
    typification.is_active = not typification.is_active
    await db.commit()
    await db.refresh(typification)
    return typification
