from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession
from sqlalchemy.orm import selectinload

from app.models.classification import TicketCategory, TicketSubcategory, TicketTypification
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.classification import CategoryOption, SubcategoryOption, TypificationOption
from app.services import audit_service
from app.services.classification_exceptions import (
    CategoryInUseError,
    CategoryNotFoundError,
    InvalidClassificationChainError,
    SubcategoryInUseError,
    SubcategoryNotFoundError,
    TypificationInUseError,
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
    actor: User | None = None,
) -> TicketCategory:
    category = TicketCategory(name=name, code=code, description=description, display_order=display_order)
    db.add(category)
    await db.flush()
    await audit_service.record_create(
        db,
        actor,
        entity="TicketCategory",
        entity_id=category.id,
        new_values={"name": name, "code": code, "description": description, "displayOrder": display_order},
    )
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
    actor: User | None = None,
) -> TicketCategory:
    category = await get_category_or_fail(db, category_id)
    old_values = {
        "name": category.name,
        "code": category.code,
        "description": category.description,
        "displayOrder": category.display_order,
        "isActive": category.is_active,
    }
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
    await audit_service.record_update(
        db,
        actor,
        entity="TicketCategory",
        entity_id=category_id,
        old_values=old_values,
        new_values={
            "name": category.name,
            "code": category.code,
            "description": category.description,
            "displayOrder": category.display_order,
            "isActive": category.is_active,
        },
    )
    await db.commit()
    await db.refresh(category)
    return category


async def toggle_category_active(db: DbSession, category_id: int) -> TicketCategory:
    category = await get_category_or_fail(db, category_id)
    category.is_active = not category.is_active
    await db.commit()
    return await get_category_node(db, category_id)


async def delete_category(db: DbSession, category_id: int, *, actor: User | None = None) -> None:
    """Borrado real (no lógico) — a diferencia de `toggle_category_active`,
    que es la vía normal para retirar una categoría del uso diario sin
    romper el historial. Solo se permite si NINGÚN ticket quedó clasificado
    con esta categoría: `tickets.category_id` siempre se guarda junto con
    subcategory_id/typification_id (ver `validate_chain`, todo-o-nada), así
    que basta revisar `category_id` para cubrir también sus subcategorías y
    tipificaciones hijas. Si está en uso, se rechaza — el Admin debe
    desactivarla en su lugar. Si no está en uso, el DELETE cae en cascada
    sobre sus subcategorías/tipificaciones vía `ON DELETE CASCADE` de la
    base (`passive_deletes=True` en el modelo, ver `models/classification.py`)."""
    category = await get_category_or_fail(db, category_id)

    in_use = (
        await db.execute(select(func.count()).select_from(Ticket).where(Ticket.category_id == category_id))
    ).scalar_one()
    if in_use:
        raise CategoryInUseError(category_id)

    await audit_service.record_delete(
        db,
        actor,
        entity="TicketCategory",
        entity_id=category_id,
        old_values={"name": category.name, "code": category.code},
    )
    await db.delete(category)
    await db.commit()


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
    actor: User | None = None,
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
    await db.flush()
    await audit_service.record_create(
        db,
        actor,
        entity="TicketSubcategory",
        entity_id=subcategory.id,
        new_values={
            "categoryId": category_id,
            "name": name,
            "code": code,
            "description": description,
            "displayOrder": display_order,
        },
    )
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
    actor: User | None = None,
) -> TicketSubcategory:
    subcategory = await get_subcategory_or_fail(db, subcategory_id)
    old_values = {
        "categoryId": subcategory.category_id,
        "name": subcategory.name,
        "code": subcategory.code,
        "description": subcategory.description,
        "displayOrder": subcategory.display_order,
        "isActive": subcategory.is_active,
    }
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
    await audit_service.record_update(
        db,
        actor,
        entity="TicketSubcategory",
        entity_id=subcategory_id,
        old_values=old_values,
        new_values={
            "categoryId": subcategory.category_id,
            "name": subcategory.name,
            "code": subcategory.code,
            "description": subcategory.description,
            "displayOrder": subcategory.display_order,
            "isActive": subcategory.is_active,
        },
    )
    await db.commit()
    await db.refresh(subcategory)
    return subcategory


async def toggle_subcategory_active(db: DbSession, subcategory_id: int) -> TicketSubcategory:
    subcategory = await get_subcategory_or_fail(db, subcategory_id)
    subcategory.is_active = not subcategory.is_active
    await db.commit()
    return await get_subcategory_node(db, subcategory_id)


async def delete_subcategory(db: DbSession, subcategory_id: int, *, actor: User | None = None) -> None:
    """Ver docstring de `delete_category` — mismo criterio (revisar
    `tickets.subcategory_id`, que cubre también sus tipificaciones hijas)."""
    subcategory = await get_subcategory_or_fail(db, subcategory_id)

    in_use = (
        await db.execute(
            select(func.count()).select_from(Ticket).where(Ticket.subcategory_id == subcategory_id)
        )
    ).scalar_one()
    if in_use:
        raise SubcategoryInUseError(subcategory_id)

    await audit_service.record_delete(
        db,
        actor,
        entity="TicketSubcategory",
        entity_id=subcategory_id,
        old_values={"categoryId": subcategory.category_id, "name": subcategory.name, "code": subcategory.code},
    )
    await db.delete(subcategory)
    await db.commit()


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
    actor: User | None = None,
) -> TicketTypification:
    """Decisión de negocio (mejora post-Fase-9): la prioridad ya NO se
    sugiere/hereda desde la tipificación, se asigna siempre directo en el
    ticket. Ya no se lee ni asigna `default_priority` aquí — la columna
    real sigue existiendo en la base (NestJS/`backend/` todavía la usa en
    producción) y se queda con el `DEFAULT 'MEDIUM'` que ya tiene a nivel
    de tabla, sin necesidad de setearla explícitamente desde este código."""
    await get_subcategory_or_fail(db, subcategory_id)
    typification = TicketTypification(
        subcategory_id=subcategory_id,
        name=name,
        code=code,
        description=description,
        display_order=display_order,
    )
    db.add(typification)
    await db.flush()
    await audit_service.record_create(
        db,
        actor,
        entity="TicketTypification",
        entity_id=typification.id,
        new_values={
            "subcategoryId": subcategory_id,
            "name": name,
            "code": code,
            "description": description,
            "displayOrder": display_order,
        },
    )
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
    is_active: bool | None = None,
    actor: User | None = None,
) -> TicketTypification:
    """Ya no recibe/asigna `default_priority` (ver docstring de
    create_typification para el porqué) — la columna sigue existiendo
    intacta en la base, simplemente este servicio dejó de tocarla."""
    typification = await get_typification_or_fail(db, typification_id)
    old_values = {
        "subcategoryId": typification.subcategory_id,
        "name": typification.name,
        "code": typification.code,
        "description": typification.description,
        "displayOrder": typification.display_order,
        "isActive": typification.is_active,
    }
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
    if is_active is not None:
        typification.is_active = is_active
    await audit_service.record_update(
        db,
        actor,
        entity="TicketTypification",
        entity_id=typification_id,
        old_values=old_values,
        new_values={
            "subcategoryId": typification.subcategory_id,
            "name": typification.name,
            "code": typification.code,
            "description": typification.description,
            "displayOrder": typification.display_order,
            "isActive": typification.is_active,
        },
    )
    await db.commit()
    await db.refresh(typification)
    return typification


async def toggle_typification_active(db: DbSession, typification_id: int) -> TicketTypification:
    typification = await get_typification_or_fail(db, typification_id)
    typification.is_active = not typification.is_active
    await db.commit()
    await db.refresh(typification)
    return typification


async def delete_typification(db: DbSession, typification_id: int, *, actor: User | None = None) -> None:
    """Ver docstring de `delete_category` — mismo criterio, nivel hoja
    (revisa `tickets.typification_id` directo)."""
    typification = await get_typification_or_fail(db, typification_id)

    in_use = (
        await db.execute(
            select(func.count()).select_from(Ticket).where(Ticket.typification_id == typification_id)
        )
    ).scalar_one()
    if in_use:
        raise TypificationInUseError(typification_id)

    await audit_service.record_delete(
        db,
        actor,
        entity="TicketTypification",
        entity_id=typification_id,
        old_values={
            "subcategoryId": typification.subcategory_id,
            "name": typification.name,
            "code": typification.code,
        },
    )
    await db.delete(typification)
    await db.commit()
