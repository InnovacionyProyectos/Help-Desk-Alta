import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { Button } from '@shared/components/Button';

const NAV_ITEMS: { to: string; label: string; roles?: Array<'ADMIN' | 'TECHNICIAN' | 'END_USER'> }[] = [
  { to: '/dashboard', label: 'Panel' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/tickets/new', label: 'Nuevo Ticket' },
  { to: '/reports', label: 'Reportes', roles: ['ADMIN'] },
  { to: '/admin/users', label: 'Usuarios', roles: ['ADMIN'] },
  { to: '/admin/classification', label: 'Clasificación', roles: ['ADMIN'] },
];

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <span className="app-sidebar__brand-mark">alta</span>
          <span className="app-sidebar__brand-sub">Help Desk</span>
        </div>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/tickets'}
            className={({ isActive }) =>
              `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <strong>{user?.fullName}</strong>
            <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: 13 }}>
              {roleLabel(user?.role)}
            </span>
          </div>
          <Button variant="secondary" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function roleLabel(role?: string) {
  switch (role) {
    case 'ADMIN':
      return 'Administrador';
    case 'TECHNICIAN':
      return 'Técnico';
    case 'END_USER':
      return 'Usuario Final';
    default:
      return '';
  }
}
