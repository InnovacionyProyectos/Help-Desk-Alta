import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../api/ticketsApi';
import { Spinner } from '@shared/components/Spinner';
import { EmptyState } from '@shared/components/EmptyState';

export function HistoryTimeline({ ticketId }: { ticketId: string }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['tickets', 'history', ticketId],
    queryFn: () => ticketsApi.getHistory(ticketId),
  });

  if (isLoading) return <Spinner />;
  if (!events || events.length === 0) return <EmptyState title="Sin cambios registrados" />;

  return (
    <div className="timeline">
      {events.map((event, index) => (
        <div className="timeline__item" key={index}>
          <span className="timeline__dot" />
          <div className="timeline__body">
            {event.type === 'STATUS_CHANGE' ? (
              <>
                <strong>{event.by}</strong> cambió el estado
                {event.from ? ` de ${event.from} a ` : ' a '}
                <strong>{event.to}</strong>
              </>
            ) : (
              <>
                <strong>{event.by}</strong> asignó el ticket
                {event.from ? ` de ${event.from} a ` : ' a '}
                <strong>{event.to}</strong>
              </>
            )}
            {event.reason && <div>“{event.reason}”</div>}
            <div>{new Date(event.createdAt).toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
