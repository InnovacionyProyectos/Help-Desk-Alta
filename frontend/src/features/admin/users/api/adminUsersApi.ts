import { httpClient } from '@shared/api/httpClient';
import { RoleCode } from '@app/store/authStore';

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  END_USER: 'Usuario Final',
};

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  role: { id: number; code: RoleCode; name: string };
  area?: { id: number; name: string };
  isActive: boolean;
  lockedUntil?: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleCode: RoleCode;
  areaId?: number;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'password'>> & {
  isActive?: boolean;
};

export const adminUsersApi = {
  list: () => httpClient.get<AdminUser[]>('/users').then((r) => r.data),

  create: (payload: CreateUserPayload) =>
    httpClient.post<AdminUser>('/users', payload).then((r) => r.data),

  update: (id: string, payload: UpdateUserPayload) =>
    httpClient.patch<AdminUser>(`/users/${id}`, payload).then((r) => r.data),

  remove: (id: string) => httpClient.delete(`/users/${id}`),

  unlock: (id: string) => httpClient.patch<AdminUser>(`/users/${id}/unlock`).then((r) => r.data),
};
