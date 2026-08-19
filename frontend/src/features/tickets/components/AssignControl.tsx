import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/ticketsApi';
import { usersApi } from '../api/usersApi';
import { Ticket } from '@shared/types/ticket';
import { SelectField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

export function AssignControl({ ticket }: { ticket: Ticket }) {
  const queryClient = useQueryClient();
  const [technicianId, setTechnicianId] = useState('');

  const { data: technicians = [] } = useQuery({
    queryKey: ['users', 'technicians'],
    queryFn: usersApi.listTechnicians,
  });

  const mutation = useMutation({
    mutationFn: () => ticketsApi.assign(ticket.id, technicianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'history', ticket.id] });
      setTechnicianId('');
    },
  });

  return (
    <div>
      <SelectField
        label={ticket.assignedTo ? `Reasignar (actual: ${ticket.assignedTo.fullName})` : 'Asignar a'}
        value={technicianId}
        onChange={(e) => setTechnicianId(e.target.value)}
      >
        <option value="">Seleccione un técnico...</option>
        {technicians.map((tech) => (
          <option key={tech.id} value={tech.id}>
            {tech.fullName}
          </option>
        ))}
      </SelectField>

      <Button
        loading={mutation.isPending}
        disabled={!technicianId}
        onClick={() => mutation.mutate()}
      >
        {ticket.assignedTo ? 'Reasignar' : 'Asignar'}
      </Button>
    </div>
  );
}
