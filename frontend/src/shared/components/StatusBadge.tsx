import { TICKET_STATUS_LABELS, TicketStatusCode } from '@shared/types/ticket';

export function StatusBadge({ code }: { code: TicketStatusCode }) {
  return (
    <span className="badge" style={{ backgroundColor: `var(--status-${code.toLowerCase()})` }}>
      {TICKET_STATUS_LABELS[code]}
    </span>
  );
}
