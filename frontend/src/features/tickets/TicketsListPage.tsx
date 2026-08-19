import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ticketsApi, TicketListScope } from './api/ticketsApi';
import { TicketPriority, TicketStatusCode, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from '@shared/types/ticket';
import { StatusBadge } from '@shared/components/StatusBadge';
import { PriorityBadge } from '@shared/components/PriorityBadge';
import { SelectField } from '@shared/components/FormField';
import { Spinner } from '@shared/components/Spinner';
import { EmptyState } from '@shared/components/EmptyState';
import { Pagination } from '@shared/components/Pagination';
import { useAuthStore } from '@app/store/authStore';

const STATUS_OPTIONS: TicketStatusCode[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];
const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function TicketsListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);

  // Admin/Técnico ven la bandeja general u ofertas propias; Usuario Final solo sus tickets.
  const [scope, setScope] = useState<TicketListScope>(role === 'END_USER' ? 'mine' : 'all');
  const [status, setStatus] = useState<TicketStatusCode | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', scope, status, priority, page],
    queryFn: () =>
      ticketsApi.list(scope, {
        status: status || undefined,
        priority: priority || undefined,
        page,
        limit: 20,
      }),
  });

  return (
    <>
      <div className="page-header">
        <h1>Tickets</h1>
      </div>

      <div className="filters-bar">
        {role !== 'END_USER' && (
          <SelectField
            label="Vista"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as TicketListScope);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            {role === 'TECHNICIAN' && <option value="assigned-to-me">Asignados a mí</option>}
          </SelectField>
        )}

        <SelectField
          label="Estado"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TicketStatusCode | '');
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Prioridad"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value as TicketPriority | '');
            setPage(1);
          }}
        >
          <option value="">Todas</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {TICKET_PRIORITY_LABELS[p]}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="card">
        {isLoading ? (
          <Spinner />
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="No hay tickets que coincidan con los filtros" />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Asunto</th>
                  <th>Solicitante</th>
                  <th>Asignado</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((ticket) => (
                  <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                    <td>{ticket.ticketNumber}</td>
                    <td>{ticket.subject}</td>
                    <td>{ticket.requester.fullName}</td>
                    <td>{ticket.assignedTo?.fullName ?? '—'}</td>
                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td>
                      <StatusBadge code={ticket.status.code} />
                    </td>
                    <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
