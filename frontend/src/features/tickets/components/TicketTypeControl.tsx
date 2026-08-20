import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/ticketsApi';
import { Ticket, TICKET_TYPE_LABELS, TicketType } from '@shared/types/ticket';
import { SelectField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

const TICKET_TYPES: TicketType[] = ['INCIDENTE', 'REQUERIMIENTO', 'CONSULTA'];

export function TicketTypeControl({ ticket }: { ticket: Ticket }) {
  const queryClient = useQueryClient();
  const [ticketType, setTicketType] = useState<TicketType>(ticket.ticketType);

  const mutation = useMutation({
    mutationFn: (value: TicketType) => ticketsApi.updateTicketType(ticket.id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticket.id] });
    },
  });

  return (
    <div>
      <SelectField
        label="Tipo"
        value={ticketType}
        onChange={(e) => setTicketType(e.target.value as TicketType)}
      >
        {TICKET_TYPES.map((t) => (
          <option key={t} value={t}>
            {TICKET_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>

      <Button
        loading={mutation.isPending}
        disabled={ticketType === ticket.ticketType}
        onClick={() => mutation.mutate(ticketType)}
      >
        Actualizar tipo
      </Button>
    </div>
  );
}
