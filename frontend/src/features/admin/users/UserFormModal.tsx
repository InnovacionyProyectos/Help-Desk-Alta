import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AdminUser, ROLE_LABELS, adminUsersApi } from './api/adminUsersApi';
import { useAreas } from '@shared/hooks/useAreas';
import { Modal } from '@shared/components/Modal';
import { TextField, SelectField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

// `password` es opcional a nivel de esquema porque el mismo formulario
// sirve para crear y editar; en modo edición el campo ni se renderiza, y en
// modo creación su longitud mínima se valida a mano en onSubmit (más simple
// que dos schemas/tipos distintos condicionados a `isEdit`).
const userFormSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().optional(),
  firstName: z.string().min(1, 'Requerido').max(80),
  lastName: z.string().min(1, 'Requerido').max(80),
  phone: z.string().max(30).optional().or(z.literal('')),
  roleCode: z.enum(['ADMIN', 'TECHNICIAN', 'END_USER'], {
    errorMap: () => ({ message: 'Seleccione un rol' }),
  }),
  areaId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormModalProps {
  user?: AdminUser; // presente = modo edición
  onClose: () => void;
}

export function UserFormModal({ user, onClose }: UserFormModalProps) {
  const isEdit = !!user;
  const queryClient = useQueryClient();
  const { data: areas = [] } = useAreas();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: user
      ? {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone ?? '',
          roleCode: user.role.code,
          areaId: user.area ? String(user.area.id) : '',
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      const areaId = values.areaId ? Number(values.areaId) : undefined;
      if (isEdit) {
        return adminUsersApi.update(user!.id, {
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || undefined,
          roleCode: values.roleCode,
          areaId,
        });
      }
      return adminUsersApi.create({
        email: values.email,
        password: values.password!,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
        roleCode: values.roleCode,
        areaId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        setServerError('Ya existe un usuario con ese correo');
      } else {
        setServerError('No se pudo guardar el usuario. Intente nuevamente.');
      }
    },
  });

  const onSubmit = (values: UserFormValues) => {
    setServerError(null);
    if (!isEdit && (!values.password || values.password.length < 8)) {
      setError('password', { message: 'Mínimo 8 caracteres' });
      return;
    }
    mutation.mutate(values);
  };

  return (
    <Modal title={isEdit ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}>
      {serverError && <div className="auth-error">{serverError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Correo electrónico"
          type="email"
          disabled={isEdit}
          error={errors.email?.message}
          {...register('email')}
        />

        {!isEdit && (
          <TextField
            label="Contraseña temporal"
            type="password"
            error={errors.password?.message}
            {...register('password')}
          />
        )}

        <div className="form-row">
          <TextField label="Nombres" error={errors.firstName?.message} {...register('firstName')} />
          <TextField label="Apellidos" error={errors.lastName?.message} {...register('lastName')} />
        </div>

        <div className="form-row">
          <TextField label="Teléfono (opcional)" error={errors.phone?.message} {...register('phone')} />
          <SelectField label="Rol" error={errors.roleCode?.message} {...register('roleCode')}>
            <option value="">Seleccione...</option>
            {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((code) => (
              <option key={code} value={code}>
                {ROLE_LABELS[code]}
              </option>
            ))}
          </SelectField>
        </div>

        <SelectField label="Área (opcional)" {...register('areaId')}>
          <option value="">Sin asignar</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </SelectField>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
