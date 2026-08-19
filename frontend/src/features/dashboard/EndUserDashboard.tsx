import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from './api/dashboardApi';
import { TicketMiniList } from './components/TicketMiniList';
import { Spinner } from '@shared/components/Spinner';
import { Button } from '@shared/components/Button';

export function EndUserDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'end-user'],
    queryFn: dashboardApi.getEndUser,
  });

  if (isLoading || !data) return <Spinner />;

  const activeTickets = data.tickets.filter((t) => !t.status.isFinal);

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Mis solicitudes activas ({activeTickets.length})</h3>
        <Button onClick={() => navigate('/tickets/new')}>+ Nuevo Ticket</Button>
      </div>
      <TicketMiniList tickets={activeTickets} emptyLabel="No tienes solicitudes activas" />
    </div>
  );
}
