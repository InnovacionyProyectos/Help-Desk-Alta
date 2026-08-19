import { Navigate, Outlet } from 'react-router-dom';
import { RoleCode, useAuthStore } from '@app/store/authStore';

interface RequireRoleProps {
  roles?: RoleCode[]; // si se omite, solo exige estar autenticado
}

export function RequireRole({ roles }: RequireRoleProps) {
  const user = useAuthStore((state) => state.user);

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;

  return <Outlet />;
}
