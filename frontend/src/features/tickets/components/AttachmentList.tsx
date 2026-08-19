import { useQuery } from '@tanstack/react-query';
import { attachmentsApi } from '../api/attachmentsApi';
import { EmptyState } from '@shared/components/EmptyState';
import { Spinner } from '@shared/components/Spinner';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ ticketId }: { ticketId: string }) {
  const { data: attachments, isLoading } = useQuery({
    queryKey: ['tickets', 'attachments', ticketId],
    queryFn: () => attachmentsApi.listByTicket(ticketId),
  });

  if (isLoading) return <Spinner />;
  if (!attachments || attachments.length === 0) {
    return <EmptyState title="Sin archivos adjuntos" />;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            padding: '8px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span>
            📎 {attachment.fileName}
            <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>
              {formatSize(attachment.sizeBytes)} · {attachment.uploadedBy.fullName}
            </span>
          </span>
          <button
            type="button"
            onClick={() => attachmentsApi.download(attachment)}
            style={{ border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Descargar
          </button>
        </li>
      ))}
    </ul>
  );
}
