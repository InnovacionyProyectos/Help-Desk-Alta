import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/ticketsApi';
import { Ticket, TICKET_PRIORITY_LABELS, TicketPriority } from '@shared/types/ticket';
import { SelectField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Prioridad desligada de la categoría/tipificación: la tipificación solo
// sugiere una prioridad por defecto al crear el ticket, pero Admin/Técnico
// pueden cambiarla libremente en cualquier momento desde aquí.
export function PriorityControl({ ticket }: { ticket: Ticket }) {
  const queryClient = useQueryClient();
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);

  const mutation = useMutation({
    mutationFn: (value: TicketPriority) => ticketsApi.updatePriority(ticket.id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticket.id] });
    },
  });

  return (
    <div>
      <SelectField
        label="Prioridad"
        value={priority}
        onChange={(e) => setPriority(e.target.value as TicketPriority)}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {TICKET_PRIORITY_LABELS[p]}
          </option>
        ))}
      </SelectField>

      <Button
        loading={mutation.isPending}
        disabled={priority === ticket.priority}
        onClick={() => mutation.mutate(priority)}
      >
        Actualizar prioridad
      </Button>
    </div>
  );
}
