import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { httpClient } from '@shared/api/httpClient';

interface TypificationOption {
  id: number;
  name: string;
  defaultPriority: string;
  slaHours?: number;
}
interface SubcategoryOption {
  id: number;
  name: string;
  typifications: TypificationOption[];
}
interface CategoryOption {
  id: number;
  name: string;
  subcategories: SubcategoryOption[];
}

/**
 * Consume GET /classification/cascade (una sola llamada) y deriva en
 * memoria las opciones de subcategoría/tipificación según lo seleccionado,
 * para alimentar los 3 <select> encadenados del formulario de ticket.
 */
export function useCascadeSelect(categoryId?: number, subcategoryId?: number) {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['classification', 'cascade'],
    queryFn: async () => (await httpClient.get<CategoryOption[]>('/classification/cascade')).data,
    staleTime: 5 * 60_000, // el árbol cambia poco; evita refetch en cada render de formulario
  });

  const subcategories = useMemo(
    () => categories.find((c) => c.id === categoryId)?.subcategories ?? [],
    [categories, categoryId],
  );

  const typifications = useMemo(
    () => subcategories.find((s) => s.id === subcategoryId)?.typifications ?? [],
    [subcategories, subcategoryId],
  );

  return { categories, subcategories, typifications, isLoading };
}
