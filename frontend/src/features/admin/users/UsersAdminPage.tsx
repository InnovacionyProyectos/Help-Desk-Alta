import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminUser, ROLE_LABELS, adminUsersApi } from './api/adminUsersApi';
import { UserFormModal } from './UserFormModal';
import { Button } from '@shared/components/Button';
import { Spinner } from '@shared/components/Spinner';
import { EmptyState } from '@shared/components/EmptyState';

export function UsersAdminPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminUsersApi.list,
  });

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const toggleActiveMutation = useMutation({
    mutationFn: (user: AdminUser) => adminUsersApi.update(user.id, { isActive: !user.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => adminUsersApi.unlock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  return (
    <>
      <div className="page-header">
        <h1>Usuarios</h1>
        <Button onClick={() => setIsCreating(true)}>+ Nuevo usuario</Button>
      </div>

      <div className="card">
        {isLoading ? (
          <Spinner />
        ) : !users || users.length === 0 ? (
          <EmptyState title="No hay usuarios registrados" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Área</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isLocked = !!user.lockedUntil && new Date(user.lockedUntil) > new Date();
                return (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>{ROLE_LABELS[user.role.code]}</td>
                    <td>{user.area?.name ?? '—'}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ backgroundColor: user.isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                      >
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                      {isLocked && (
                        <span className="badge" style={{ backgroundColor: 'var(--color-danger)', marginLeft: 6 }}>
                          Bloqueado
                        </span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="link-btn" type="button" onClick={() => setEditingUser(user)}>
                          Editar
                        </button>
                        <button
                          className={`link-btn${user.isActive ? ' link-btn--danger' : ''}`}
                          type="button"
                          onClick={() => toggleActiveMutation.mutate(user)}
                        >
                          {user.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        {isLocked && (
                          <button
                            className="link-btn"
                            type="button"
                            onClick={() => unlockMutation.mutate(user.id)}
                          >
                            Desbloquear
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isCreating && <UserFormModal onClose={() => setIsCreating(false)} />}
      {editingUser && <UserFormModal user={editingUser} onClose={() => setEditingUser(null)} />}
    </>
  );
}
