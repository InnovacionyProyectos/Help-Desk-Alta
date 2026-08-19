import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CategoryNode,
  SubcategoryNode,
  TypificationNode,
  classificationAdminApi,
} from './api/classificationAdminApi';
import { TICKET_PRIORITY_LABELS, TicketPriority } from '@shared/types/ticket';
import { Modal } from '@shared/components/Modal';
import { TextField, TextAreaField, SelectField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

// Un único esquema para los 3 niveles: los campos de tipificación
// (defaultPriority/slaHours) quedan opcionales y solo se muestran/usan
// cuando kind === 'typification'. Evita 3 tipos de formulario distintos
// para una estructura que es, en el fondo, la misma (nombre + jerarquía).
const schema = z.object({
  name: z.string().min(1, 'Requerido').max(100),
  code: z.string().max(20).optional().or(z.literal('')),
  description: z.string().max(255).optional().or(z.literal('')),
  displayOrder: z.coerce.number().int().min(0).optional(),
  defaultPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  slaHours: z.coerce.number().int().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

type Kind = 'category' | 'subcategory' | 'typification';

interface ClassificationFormModalProps {
  kind: Kind;
  node?: CategoryNode | SubcategoryNode | TypificationNode; // presente = editar
  parentId?: number; // categoryId (al crear subcategoría) o subcategoryId (al crear tipificación)
  onClose: () => void;
}

const TITLES: Record<Kind, string> = {
  category: 'Categoría',
  subcategory: 'Subcategoría',
  typification: 'Tipificación',
};

export function ClassificationFormModal({ kind, node, parentId, onClose }: ClassificationFormModalProps) {
  const isEdit = !!node;
  const queryClient = useQueryClient();
  const typificationNode = kind === 'typification' ? (node as TypificationNode | undefined) : undefined;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: node
      ? {
          name: node.name,
          code: node.code ?? '',
          description: node.description ?? '',
          displayOrder: node.displayOrder,
          defaultPriority: typificationNode?.defaultPriority,
          slaHours: typificationNode?.slaHours,
        }
      : { displayOrder: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const base = {
        name: values.name,
        code: values.code || undefined,
        description: values.description || undefined,
        displayOrder: values.displayOrder,
      };

      if (kind === 'category') {
        return isEdit
          ? classificationAdminApi.updateCategory(node!.id, base)
          : classificationAdminApi.createCategory(base);
      }

      if (kind === 'subcategory') {
        return isEdit
          ? classificationAdminApi.updateSubcategory(node!.id, base)
          : classificationAdminApi.createSubcategory({ ...base, categoryId: parentId! });
      }

      const typificationBody = {
        ...base,
        defaultPriority: values.defaultPriority as TicketPriority,
        slaHours: values.slaHours,
      };
      return isEdit
        ? classificationAdminApi.updateTypification(node!.id, typificationBody)
        : classificationAdminApi.createTypification({ ...typificationBody, subcategoryId: parentId! });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classification'] });
      onClose();
    },
  });

  return (
    <Modal title={`${isEdit ? 'Editar' : 'Nueva'} ${TITLES[kind].toLowerCase()}`} onClose={onClose}>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <TextField label="Nombre" error={errors.name?.message} {...register('name')} />
        <TextField label="Código (opcional)" error={errors.code?.message} {...register('code')} />
        <TextAreaField
          label="Descripción (opcional)"
          error={errors.description?.message}
          {...register('description')}
        />

        {kind === 'typification' && (
          <div className="form-row">
            <SelectField label="Prioridad por defecto" {...register('defaultPriority')}>
              {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => (
                <option key={p} value={p}>
                  {TICKET_PRIORITY_LABELS[p]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="SLA (horas, opcional)"
              type="number"
              min={0}
              error={errors.slaHours?.message}
              {...register('slaHours')}
            />
          </div>
        )}

        <TextField
          label="Orden de visualización"
          type="number"
          min={0}
          error={errors.displayOrder?.message}
          {...register('displayOrder')}
        />

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Guardar
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
