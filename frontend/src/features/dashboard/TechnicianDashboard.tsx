import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api/dashboardApi';
import { TicketMiniList } from './components/TicketMiniList';
import { Spinner } from '@shared/components/Spinner';

export function TechnicianDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'technician'],
    queryFn: dashboardApi.getTechnician,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="detail-grid">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Mis tickets asignados ({data.myTickets.length})</h3>
        <TicketMiniList tickets={data.myTickets} emptyLabel="No tienes tickets asignados" />
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Pendientes del equipo ({data.teamPending.length})</h3>
        <TicketMiniList tickets={data.teamPending} emptyLabel="No hay tickets sin asignar" />
      </div>
    </div>
  );
}
