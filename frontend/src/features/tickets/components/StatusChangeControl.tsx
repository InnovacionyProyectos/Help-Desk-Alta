import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/ticketsApi';
import { Ticket, TICKET_STATUS_LABELS, TicketStatusCode } from '@shared/types/ticket';
import { SelectField, TextField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';
import { useAuthStore } from '@app/store/authStore';

const ALL_STATUSES: TicketStatusCode[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];

export function StatusChangeControl({ ticket }: { ticket: Ticket }) {
  const role = useAuthStore((state) => state.user?.role);
  const queryClient = useQueryClient();
  const [toStatus, setToStatus] = useState<TicketStatusCode | ''>('');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: { toStatus: TicketStatusCode; reason?: string }) =>
      ticketsApi.changeStatus(ticket.id, payload.toStatus, payload.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'history', ticket.id] });
      setToStatus('');
      setReason('');
    },
  });

  // Usuario Final: única acción permitida es reabrir un ticket resuelto/cerrado.
  if (role === 'END_USER') {
    if (!ticket.status.isFinal && ticket.status.code !== 'RESOLVED') return null;
    return (
      <Button
        variant="secondary"
        loading={mutation.isPending}
        onClick={() => mutation.mutate({ toStatus: 'REOPENED' })}
      >
        Reabrir ticket
      </Button>
    );
  }

  const options = ALL_STATUSES.filter((s) => s !== ticket.status.code);

  return (
    <div>
      <SelectField
        label="Cambiar estado"
        value={toStatus}
        onChange={(e) => setToStatus(e.target.value as TicketStatusCode | '')}
      >
        <option value="">Seleccione...</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {TICKET_STATUS_LABELS[s]}
          </option>
        ))}
      </SelectField>

      {toStatus && (
        <>
          <TextField
            label="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            loading={mutation.isPending}
            disabled={!toStatus}
            onClick={() => toStatus && mutation.mutate({ toStatus, reason: reason || undefined })}
          >
            Confirmar cambio
          </Button>
        </>
      )}
    </div>
  );
}
