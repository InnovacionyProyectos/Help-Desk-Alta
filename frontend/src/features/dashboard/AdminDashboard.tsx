import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api/dashboardApi';
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from '@shared/types/ticket';
import { Spinner } from '@shared/components/Spinner';

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

      <div className="detail-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Distribución por estado</h3>
          <BarBreakdown
            items={data.byStatus.map((s) => ({
              label: TICKET_STATUS_LABELS[s.status],
              value: Number(s.total),
            }))}
          />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Distribución por prioridad</h3>
          <BarBreakdown
            items={data.byPriority.map((p) => ({
              label: TICKET_PRIORITY_LABELS[p.priority],
              value: Number(p.total),
            }))}
          />
        </div>
      </div>
    </>
  );
}

function BarBreakdown({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div style={{ background: 'var(--color-bg)', borderRadius: 4, height: 8 }}>
            <div
              style={{
                width: `${(item.value / max) * 100}%`,
                background: 'var(--color-primary)',
                height: 8,
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
