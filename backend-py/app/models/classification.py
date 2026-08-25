from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, SmallInteger, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# created_at/updated_at usan server_default=now() porque la tabla real los
# rellena con DEFAULT now() (updated_at además se mantiene con el trigger
# trg_set_updated_at en cada UPDATE) — sin server_default, SQLAlchemy manda
# NULL explícito en el INSERT en lugar de dejar que la base los calcule.


class TicketCategory(Base):
    __tablename__ = "ticket_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    code: Mapped[str | None] = mapped_column(String(20), unique=True)
    description: Mapped[str | None] = mapped_column(String(255))
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    # passive_deletes=True: al borrar una categoría, dejar que el FK
    # ON DELETE CASCADE de la base borre las subcategorías directamente en
    # vez de que SQLAlchemy intente poner category_id=NULL primero (lo cual
    # violaría el NOT NULL de esa columna).
    subcategories: Mapped[list["TicketSubcategory"]] = relationship(
        back_populates="category",
        order_by="TicketSubcategory.display_order, TicketSubcategory.name",
        passive_deletes=True,
    )


class TicketSubcategory(Base):
    __tablename__ = "ticket_subcategories"
    __table_args__ = (UniqueConstraint("category_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("ticket_categories.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(String(255))
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    category: Mapped["TicketCategory"] = relationship(back_populates="subcategories")
    typifications: Mapped[list["TicketTypification"]] = relationship(
        back_populates="subcategory",
        order_by="TicketTypification.display_order, TicketTypification.name",
        passive_deletes=True,
    )


class TicketTypification(Base):
    __tablename__ = "ticket_typifications"
    __table_args__ = (UniqueConstraint("subcategory_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    subcategory_id: Mapped[int] = mapped_column(ForeignKey("ticket_subcategories.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(String(255))
    # CHECK (default_priority IN ('LOW','MEDIUM','HIGH','CRITICAL')) ya existe en el DDL.
    default_priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    subcategory: Mapped["TicketSubcategory"] = relationship(back_populates="typifications")
