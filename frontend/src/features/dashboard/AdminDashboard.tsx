import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api/dashboardApi';
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, TicketStatusCode, TicketType } from '@shared/types/ticket';
import { Spinner } from '@shared/components/Spinner';
import { ChartCard } from '@shared/components/ChartCard';
import { DonutChart } from '@shared/components/DonutChart';
import { BarChart } from '@shared/components/BarChart';

// Mismos colores que StatusBadge/TicketTypeBadge (var(--status-*)/var(--type-*)
// en index.css) para que la identidad visual sea consistente entre el gráfico
// y las etiquetas que se ven en el detalle/listado de tickets.
const STATUS_COLORS: Record<TicketStatusCode, string> = {
  OPEN: 'var(--status-open)',
  ASSIGNED: 'var(--status-assigned)',
  IN_PROGRESS: 'var(--status-in_progress)',
  ON_HOLD: 'var(--status-on_hold)',
  RESOLVED: 'var(--status-resolved)',
  CLOSED: 'var(--status-closed)',
  REOPENED: 'var(--status-reopened)',
};

const TYPE_COLORS: Record<TicketType, string> = {
  INCIDENTE: 'var(--type-incidente)',
  REQUERIMIENTO: 'var(--type-requerimiento)',
  CONSULTA: 'var(--type-consulta)',
};

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: dashboardApi.getAdmin,
  });

  if (isLoading || !data) return <Spinner />;

  const totalTickets = data.byStatus.reduce((sum, item) => sum + Number(item.total), 0);
  const avgHours = data.avgResolutionHours ? Number(data.avgResolutionHours).toFixed(1) : '—';

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-card__label">Total de tickets</p>
          <p className="stat-card__value">{totalTickets}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Tiempo prom. de resolución</p>
          <p className="stat-card__value">{avgHours}h</p>
        </div>
        {data.byStatus
          .filter((item) => ['OPEN', 'IN_PROGRESS'].includes(item.status))
          .map((item) => (
            <div className="stat-card" key={item.status}>
              <p className="stat-card__label">{TICKET_STATUS_LABELS[item.status]}</p>
              <p className="stat-card__value">{item.total}</p>
            </div>
          ))}
      </div>

      <div className="chart-grid">
        <ChartCard title="Tickets por Área" subtitle="Volumen agrupado por área">
          <BarChart
            color="var(--color-primary)"
            items={data.byArea.map((a) => ({ label: a.area, value: Number(a.total) }))}
          />
        </ChartCard>

        <ChartCard title="Tickets por Tipo" subtitle="Distribución por tipología">
          <DonutChart
            items={data.byType.map((t) => ({
              label: TICKET_TYPE_LABELS[t.ticketType],
              value: Number(t.total),
              color: TYPE_COLORS[t.ticketType],
            }))}
          />
        </ChartCard>

        <ChartCard title="Tickets por Estado" subtitle="Distribución según el estado actual del ticket">
          <DonutChart
            items={data.byStatus.map((s) => ({
              label: TICKET_STATUS_LABELS[s.status],
              value: Number(s.total),
              color: STATUS_COLORS[s.status],
            }))}
          />
        </ChartCard>

        <ChartCard title="Entradas por Categoría" subtitle="Distribución del consolidado general por categoría">
          <BarChart
            color="var(--color-success)"
            items={data.byCategory.map((c) => ({ label: c.category, value: Number(c.total) }))}
          />
        </ChartCard>
      </div>
    </>
  );
}
