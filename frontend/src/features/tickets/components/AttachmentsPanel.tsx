import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentsApi } from '../api/attachmentsApi';
import { AttachmentList } from './AttachmentList';
import { Dropzone } from '@shared/components/Dropzone';

// A diferencia del formulario de creación (donde el ticket aún no existe),
// aquí el ticket ya existe: cada archivo soltado se sube de inmediato.
export function AttachmentsPanel({ ticketId, disabled }: { ticketId: string; disabled?: boolean }) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map((file) => attachmentsApi.upload(ticketId, file))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'attachments', ticketId] });
    },
  });

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Adjuntos</h3>
      <div style={{ marginBottom: 12 }}>
        <AttachmentList ticketId={ticketId} />
      </div>
      {disabled ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Este ticket está cerrado y no admite nuevos adjuntos.
        </p>
      ) : (
        <>
          <Dropzone onFilesAccepted={(files) => uploadMutation.mutate(files)} />
          {uploadMutation.isPending && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>Subiendo...</p>
          )}
        </>
      )}
    </div>
  );
}
