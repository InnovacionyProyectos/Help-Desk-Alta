import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ticketsApi } from './api/ticketsApi';
import { attachmentsApi } from './api/attachmentsApi';
import { useCascadeSelect } from '@shared/hooks/useCascadeSelect';
import { TextField, TextAreaField, SelectField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';
import { Dropzone } from '@shared/components/Dropzone';
import { StagedFileList } from './components/StagedFileList';

const createTicketSchema = z.object({
  subject: z.string().min(5, 'El asunto debe tener al menos 5 caracteres').max(200),
  description: z.string().min(10, 'Describa el problema con más detalle'),
  categoryId: z.coerce.number().int().positive('Seleccione una categoría'),
  subcategoryId: z.coerce.number().int().positive('Seleccione una subcategoría'),
  typificationId: z.coerce.number().int().positive('Seleccione una tipificación'),
});

type CreateTicketFormValues = z.infer<typeof createTicketSchema>;

export function CreateTicketPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketFormValues>({ resolver: zodResolver(createTicketSchema) });

  const categoryId = watch('categoryId');
  const subcategoryId = watch('subcategoryId');

  const { categories, subcategories, typifications, isLoading } = useCascadeSelect(
    categoryId ? Number(categoryId) : undefined,
    subcategoryId ? Number(subcategoryId) : undefined,
  );

  const createMutation = useMutation({
    mutationFn: (values: CreateTicketFormValues) => ticketsApi.create(values),
    onSuccess: async (ticket) => {
      // El ticket no existe hasta que se crea, así que los adjuntos elegidos
      // en el formulario se suben recién aquí, referenciando su id.
      if (pendingFiles.length > 0) {
        setIsUploadingAttachments(true);
        await Promise.all(pendingFiles.map((file) => attachmentsApi.upload(ticket.id, file)));
        setIsUploadingAttachments(false);
      }
      navigate(`/tickets/${ticket.id}`);
    },
    onError: () => setServerError('No se pudo crear el ticket. Intente nuevamente.'),
  });

  const onSubmit = (values: CreateTicketFormValues) => {
    setServerError(null);
    createMutation.mutate(values);
  };

  return (
    <>
      <div className="page-header">
        <h1>Nuevo Ticket</h1>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        {serverError && <div className="auth-error">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField label="Asunto" error={errors.subject?.message} {...register('subject')} />

          <TextAreaField
            label="Descripción"
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="form-row">
            <SelectField
              label="Categoría"
              error={errors.categoryId?.message}
              disabled={isLoading}
              {...register('categoryId', {
                onChange: () => {
                  resetField('subcategoryId', { defaultValue: '' as any });
                  resetField('typificationId', { defaultValue: '' as any });
                },
              })}
            >
              <option value="">Seleccione...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Subcategoría"
              error={errors.subcategoryId?.message}
              disabled={!categoryId}
              {...register('subcategoryId', {
                onChange: () => resetField('typificationId', { defaultValue: '' as any }),
              })}
            >
              <option value="">Seleccione...</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Tipificación"
              error={errors.typificationId?.message}
              disabled={!subcategoryId}
              {...register('typificationId')}
            >
              <option value="">Seleccione...</option>
              {typifications.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="form-field">
            <label>Adjuntos (opcional)</label>
            <Dropzone onFilesAccepted={(files) => setPendingFiles((prev) => [...prev, ...files])} />
            <StagedFileList
              files={pendingFiles}
              onRemove={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Button type="submit" loading={isSubmitting || isUploadingAttachments}>
              {isUploadingAttachments ? 'Subiendo adjuntos...' : 'Crear Ticket'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
