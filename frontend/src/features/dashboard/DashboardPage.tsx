import { useAuthStore } from '@app/store/authStore';
import { AdminDashboard } from './AdminDashboard';
import { TechnicianDashboard } from './TechnicianDashboard';
import { EndUserDashboard } from './EndUserDashboard';

export function DashboardPage() {
  const role = useAuthStore((state) => state.user?.role);

  return (
    <>
      <div className="page-header">
        <h1>Panel</h1>
      </div>
      {role === 'ADMIN' && <AdminDashboard />}
      {role === 'TECHNICIAN' && <TechnicianDashboard />}
      {role === 'END_USER' && <EndUserDashboard />}
    </>
  );
}
