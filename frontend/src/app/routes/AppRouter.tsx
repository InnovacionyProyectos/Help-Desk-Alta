import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@app/layout/AppLayout';
import { RequireRole } from './RequireRole';
import { ForbiddenPage } from './ForbiddenPage';
import { LoginPage } from '@features/auth/LoginPage';
import { DashboardPage } from '@features/dashboard/DashboardPage';
import { TicketsListPage } from '@features/tickets/TicketsListPage';
import { CreateTicketPage } from '@features/tickets/CreateTicketPage';
import { TicketDetailPage } from '@features/tickets/TicketDetailPage';
import { ReportsPage } from '@features/reports/ReportsPage';
import { UsersAdminPage } from '@features/admin/users/UsersAdminPage';
import { ClassificationAdminPage } from '@features/admin/classification/ClassificationAdminPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/403', element: <ForbiddenPage /> },

  {
    element: <RequireRole />, // exige sesión activa; el layout aplica a todas las rutas hijas
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/tickets', element: <TicketsListPage /> },
          { path: '/tickets/new', element: <CreateTicketPage /> },
          { path: '/tickets/:id', element: <TicketDetailPage /> },
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { path: '/reports', element: <ReportsPage /> },
              { path: '/admin/users', element: <UsersAdminPage /> },
              { path: '/admin/classification', element: <ClassificationAdminPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
