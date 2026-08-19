import { useNavigate } from 'react-router-dom';
import { Ticket } from '@shared/types/ticket';
import { StatusBadge } from '@shared/components/StatusBadge';
import { PriorityBadge } from '@shared/components/PriorityBadge';
import { EmptyState } from '@shared/components/EmptyState';

export function TicketMiniList({ tickets, emptyLabel }: { tickets: Ticket[]; emptyLabel: string }) {
  const navigate = useNavigate();

  if (tickets.length === 0) return <EmptyState title={emptyLabel} />;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Ticket</th>
          <th>Asunto</th>
          <th>Prioridad</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket) => (
          <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
            <td>{ticket.ticketNumber}</td>
            <td>{ticket.subject}</td>
            <td>
              <PriorityBadge priority={ticket.priority} />
            </td>
            <td>
              <StatusBadge code={ticket.status.code} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
