/**
 * Formas de respuesta del endpoint de cascada de clasificación.
 * Se usan directamente por los <select> encadenados del frontend.
 */

export class TypificationOptionDto {
  id: number;
  name: string;
  defaultPriority: string;
}

export class SubcategoryOptionDto {
  id: number;
  name: string;
  typifications: TypificationOptionDto[];
}

export class CategoryOptionDto {
  id: number;
  name: string;
  subcategories: SubcategoryOptionDto[];
}
