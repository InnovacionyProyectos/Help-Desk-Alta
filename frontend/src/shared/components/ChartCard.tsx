import { ReactNode } from 'react';

// El grid padre usa align-items: stretch, así toda la fila iguala su alto
// al card más grande; centramos el contenido para que ese espacio extra
// no se vea como un hueco vacío en las tarjetas más cortas.
export function ChartCard({
  title,
  subtitle,
  span,
  children,
}: {
  title: string;
  subtitle: string;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...(span ? { gridColumn: '1 / -1' } : undefined),
      }}
    >
      <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: 16, fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: '2px 0 20px', fontSize: 13, color: 'var(--color-text-muted)' }}>{subtitle}</p>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%' }}>{children}</div>
      </div>
    </div>
  );
}
