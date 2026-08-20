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
  const [showReasonError, setShowReasonError] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: { toStatus: TicketStatusCode; reason: string }) =>
      ticketsApi.changeStatus(ticket.id, payload.toStatus, payload.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'history', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'comments', ticket.id] });
      setToStatus('');
      setReason('');
      setShowReasonError(false);
    },
  });

  const reasonTrimmed = reason.trim();

  const submit = (status: TicketStatusCode) => {
    if (!reasonTrimmed) {
      setShowReasonError(true);
      return;
    }
    mutation.mutate({ toStatus: status, reason: reasonTrimmed });
  };

  // CLOSED es terminal de verdad: nadie (ni Admin) puede cambiar el estado
  // de un ticket cerrado. El backend ya lo rechaza; esto es solo para no
  // mostrar controles que igual fallarían.
  if (ticket.status.code === 'CLOSED') {
    return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Este ticket está cerrado y no puede cambiar de estado.</p>;
  }

  // Usuario Final: única acción permitida es reabrir un ticket resuelto,
  // y también debe justificar el motivo.
  if (role === 'END_USER') {
    if (ticket.status.code !== 'RESOLVED') return null;
    return (
      <div>
        <TextField
          label="Motivo de la reapertura"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setShowReasonError(false);
          }}
          error={showReasonError ? 'El motivo es obligatorio' : undefined}
        />
        <Button variant="secondary" loading={mutation.isPending} onClick={() => submit('REOPENED')}>
          Reabrir ticket
        </Button>
      </div>
    );
  }

  const options = ALL_STATUSES.filter((s) => s !== ticket.status.code);

  return (
    <div>
      <SelectField
        label="Cambiar estado"
        value={toStatus}
        onChange={(e) => {
          setToStatus(e.target.value as TicketStatusCode | '');
          setShowReasonError(false);
        }}
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
            label="Motivo"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setShowReasonError(false);
            }}
            error={showReasonError ? 'El motivo es obligatorio' : undefined}
          />
          <Button loading={mutation.isPending} onClick={() => submit(toStatus)}>
            Confirmar cambio
          </Button>
        </>
      )}
    </div>
  );
}
