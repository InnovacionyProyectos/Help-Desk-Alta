import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/ticketsApi';
import { useCascadeSelect } from '@shared/hooks/useCascadeSelect';
import { Ticket } from '@shared/types/ticket';
import { SelectField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

// Visible solo para Admin/Técnico (ver TicketDetailPage): el Usuario Final
// crea el ticket sin categoría, y esta es la vía para asignarla después.
export function ClassifyControl({ ticket }: { ticket: Ticket }) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState(ticket.category ? String(ticket.category.id) : '');
  const [subcategoryId, setSubcategoryId] = useState(
    ticket.subcategory ? String(ticket.subcategory.id) : '',
  );
  const [typificationId, setTypificationId] = useState(
    ticket.typification ? String(ticket.typification.id) : '',
  );

  const { categories, subcategories, typifications } = useCascadeSelect(
    categoryId ? Number(categoryId) : undefined,
    subcategoryId ? Number(subcategoryId) : undefined,
  );

  const mutation = useMutation({
    mutationFn: () =>
      ticketsApi.classify(ticket.id, {
        categoryId: Number(categoryId),
        subcategoryId: Number(subcategoryId),
        typificationId: Number(typificationId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticket.id] });
    },
  });

  const isComplete = categoryId && subcategoryId && typificationId;

  return (
    <div>
      <SelectField
        label="Categoría"
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setSubcategoryId('');
          setTypificationId('');
        }}
      >
        <option value="">Seleccione...</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Subcategoría"
        value={subcategoryId}
        disabled={!categoryId}
        onChange={(e) => {
          setSubcategoryId(e.target.value);
          setTypificationId('');
        }}
      >
        <option value="">Seleccione...</option>
        {subcategories.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Tipificación"
        value={typificationId}
        disabled={!subcategoryId}
        onChange={(e) => setTypificationId(e.target.value)}
      >
        <option value="">Seleccione...</option>
        {typifications.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </SelectField>

      <Button loading={mutation.isPending} disabled={!isComplete} onClick={() => mutation.mutate()}>
        {ticket.category ? 'Reclasificar' : 'Clasificar ticket'}
      </Button>
    </div>
  );
}
