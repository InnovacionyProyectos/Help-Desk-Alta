import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/ticketsApi';
import { attachmentsApi } from '../api/attachmentsApi';
import { TextAreaField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';
import { Dropzone } from '@shared/components/Dropzone';
import { EmptyState } from '@shared/components/EmptyState';
import { Spinner } from '@shared/components/Spinner';
import { useAuthStore } from '@app/store/authStore';
import { StagedFileList } from './StagedFileList';

export function CommentThread({ ticketId, disabled }: { ticketId: string; disabled?: boolean }) {
  const role = useAuthStore((state) => state.user?.role);
  const canPostInternal = role === 'ADMIN' || role === 'TECHNICIAN';
  const queryClient = useQueryClient();

  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { data: comments, isLoading } = useQuery({
    queryKey: ['tickets', 'comments', ticketId],
    queryFn: () => ticketsApi.getComments(ticketId),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const comment = await ticketsApi.addComment(ticketId, body, isInternal);
      if (pendingFiles.length > 0) {
        await Promise.all(
          pendingFiles.map((file) => attachmentsApi.upload(ticketId, file, comment.id)),
        );
      }
      return comment;
    },
    onSuccess: () => {
      setBody('');
      setIsInternal(false);
      setPendingFiles([]);
      queryClient.invalidateQueries({ queryKey: ['tickets', 'comments', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'attachments', ticketId] });
    },
  });

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Comentarios</h3>

      {isLoading ? (
        <Spinner />
      ) : !comments || comments.length === 0 ? (
        <EmptyState title="Aún no hay comentarios" />
      ) : (
        <div className="comment-thread" style={{ marginBottom: 16 }}>
          {comments.map((comment) => (
            <div key={comment.id} className={`comment${comment.isInternal ? ' comment--internal' : ''}`}>
              <div className="comment__meta">
                <span>
                  <strong>{comment.author.fullName}</strong>
                  {comment.isInternal && ' · Nota interna'}
                </span>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      {disabled ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Este ticket está cerrado y no admite nuevos comentarios.
        </p>
      ) : (
        <>
          <TextAreaField
            label="Agregar comentario"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escriba su comentario..."
          />

          <Dropzone onFilesAccepted={(files) => setPendingFiles((prev) => [...prev, ...files])} />
          <StagedFileList
            files={pendingFiles}
            onRemove={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
          />

          {canPostInternal && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
              />
              Nota interna (solo visible para Admin/Técnico)
            </label>
          )}

          <Button
            loading={mutation.isPending}
            disabled={body.trim().length === 0}
            onClick={() => mutation.mutate()}
          >
            Comentar
          </Button>
        </>
      )}
    </div>
  );
}
