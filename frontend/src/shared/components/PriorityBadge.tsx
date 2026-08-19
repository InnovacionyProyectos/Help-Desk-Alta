import { TICKET_PRIORITY_LABELS, TicketPriority } from '@shared/types/ticket';

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className="badge" style={{ backgroundColor: `var(--priority-${priority.toLowerCase()})` }}>
      {TICKET_PRIORITY_LABELS[priority]}
    </span>
  );
}
