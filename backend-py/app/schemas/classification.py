"""Formas de respuesta del endpoint de cascada de clasificación y de los
niveles cargados bajo demanda. Equivalente a
classification-cascade-response.dto.ts del backend NestJS original."""

from pydantic import BaseModel, ConfigDict


class TypificationOption(BaseModel):
    id: int
    name: str
    default_priority: str


class SubcategoryOption(BaseModel):
    id: int
    name: str
    typifications: list[TypificationOption]


class CategoryOption(BaseModel):
    id: int
    name: str
    subcategories: list[SubcategoryOption]


class SubcategoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    display_order: int


class TypificationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    default_priority: str
    display_order: int
