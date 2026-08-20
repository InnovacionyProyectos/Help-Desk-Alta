import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from './api/ticketsApi';
import { StatusBadge } from '@shared/components/StatusBadge';
import { PriorityBadge } from '@shared/components/PriorityBadge';
import { TicketTypeBadge } from '@shared/components/TicketTypeBadge';
import { Spinner } from '@shared/components/Spinner';
import { StatusChangeControl } from './components/StatusChangeControl';
import { AssignControl } from './components/AssignControl';
import { CommentThread } from './components/CommentThread';
import { HistoryTimeline } from './components/HistoryTimeline';
import { AttachmentsPanel } from './components/AttachmentsPanel';
import { ClassifyControl } from './components/ClassifyControl';
import { PriorityControl } from './components/PriorityControl';
import { TicketTypeControl } from './components/TicketTypeControl';
import { useAuthStore } from '@app/store/authStore';
import { reportsApi } from '@features/reports/api/reportsApi';
import { Button } from '@shared/components/Button';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuthStore((state) => state.user?.role);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['tickets', 'detail', id],
    queryFn: () => ticketsApi.getOne(id!),
    enabled: !!id,
  });

  if (isLoading || !ticket) return <Spinner />;

  const canManage = role === 'ADMIN' || role === 'TECHNICIAN';
  const isClosed = ticket.status.code === 'CLOSED';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>
            {ticket.ticketNumber} · {ticket.subject}
          </h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <StatusBadge code={ticket.status.code} />
            <PriorityBadge priority={ticket.priority} />
            <TicketTypeBadge ticketType={ticket.ticketType} />
          </div>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => reportsApi.downloadTicketPdf(ticket.id, ticket.ticketNumber)}>
            Descargar PDF
          </Button>
        )}
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Descripción</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>

            <div className="form-row" style={{ marginTop: 16 }}>
              <Field label="Categoría" value={ticket.category?.name ?? 'Sin clasificar'} />
              <Field label="Subcategoría" value={ticket.subcategory?.name ?? '—'} />
              <Field label="Tipificación" value={ticket.typification?.name ?? '—'} />
            </div>
            <div className="form-row">
              <Field label="Solicitante" value={ticket.requester.fullName} />
              <Field label="Asignado a" value={ticket.assignedTo?.fullName ?? 'Sin asignar'} />
              <Field label="Creado" value={new Date(ticket.createdAt).toLocaleString()} />
            </div>
          </div>

          <div className="card">
            <AttachmentsPanel ticketId={ticket.id} disabled={isClosed} />
          </div>

          <div className="card">
            <CommentThread ticketId={ticket.id} disabled={isClosed} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {canManage && !isClosed && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Tipo</h3>
              <TicketTypeControl ticket={ticket} />
            </div>
          )}

          {canManage && !isClosed && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Clasificación</h3>
              <ClassifyControl ticket={ticket} />
            </div>
          )}

          {canManage && !isClosed && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Prioridad</h3>
              <PriorityControl ticket={ticket} />
            </div>
          )}

          {(canManage || ticket.status.code === 'RESOLVED') && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Acciones</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StatusChangeControl ticket={ticket} />
                {canManage && !isClosed && <AssignControl ticket={ticket} />}
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Historial</h3>
            <HistoryTimeline ticketId={ticket.id} />
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{value}</p>
    </div>
  );
}
