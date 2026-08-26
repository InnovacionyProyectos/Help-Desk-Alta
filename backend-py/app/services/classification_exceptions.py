class CategoryNotFoundError(Exception):
    def __init__(self, category_id: int):
        self.category_id = category_id
        super().__init__(f"Categoría {category_id} no encontrada")


class SubcategoryNotFoundError(Exception):
    def __init__(self, subcategory_id: int):
        self.subcategory_id = subcategory_id
        super().__init__(f"Subcategoría {subcategory_id} no encontrada")


class TypificationNotFoundError(Exception):
    def __init__(self, typification_id: int):
        self.typification_id = typification_id
        super().__init__(f"Tipificación {typification_id} no encontrada")


class InvalidClassificationChainError(Exception):
    """La tipificación no pertenece a esa subcategoría, la subcategoría no
    pertenece a esa categoría, o algún nivel de la cadena está inactivo."""

    def __init__(self):
        super().__init__(
            "La combinación categoría / subcategoría / tipificación no es válida o está inactiva"
        )


class CategoryInUseError(Exception):
    """Hay tickets clasificados con esta categoría (o alguna de sus
    subcategorías/tipificaciones) — borrarla dejaría esos tickets con una
    referencia rota. El Admin debe desactivarla en vez de eliminarla."""

    def __init__(self, category_id: int):
        self.category_id = category_id
        super().__init__(
            "No se puede eliminar: hay tickets clasificados con esta categoría. Desactívela en su lugar."
        )


class SubcategoryInUseError(Exception):
    """Ver CategoryInUseError — mismo caso para subcategorías."""

    def __init__(self, subcategory_id: int):
        self.subcategory_id = subcategory_id
        super().__init__(
            "No se puede eliminar: hay tickets clasificados con esta subcategoría. Desactívela en su lugar."
        )


class TypificationInUseError(Exception):
    """Ver CategoryInUseError — mismo caso para tipificaciones."""

    def __init__(self, typification_id: int):
        self.typification_id = typification_id
        super().__init__(
            "No se puede eliminar: hay tickets clasificados con esta tipificación. Desactívela en su lugar."
        )
