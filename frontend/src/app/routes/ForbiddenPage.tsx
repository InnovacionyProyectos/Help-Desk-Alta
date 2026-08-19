import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <div className="empty-state">
      <h2>403 · Acceso denegado</h2>
      <p>No tiene permisos para ver esta página.</p>
      <Link to="/dashboard">Volver al panel</Link>
    </div>
  );
}
