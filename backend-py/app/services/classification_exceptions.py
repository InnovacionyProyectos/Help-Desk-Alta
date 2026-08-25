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
