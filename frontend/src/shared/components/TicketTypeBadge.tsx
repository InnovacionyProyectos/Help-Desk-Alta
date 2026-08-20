import { TICKET_TYPE_LABELS, TicketType } from '@shared/types/ticket';

export function TicketTypeBadge({ ticketType }: { ticketType: TicketType }) {
  return (
    <span className="badge" style={{ backgroundColor: `var(--type-${ticketType.toLowerCase()})` }}>
      {TICKET_TYPE_LABELS[ticketType]}
    </span>
  );
}
