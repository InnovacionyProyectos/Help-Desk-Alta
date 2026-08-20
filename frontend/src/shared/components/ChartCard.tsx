import { ReactNode } from 'react';

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
    <div className="card" style={span ? { gridColumn: '1 / -1' } : undefined}>
      <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: 16 }}>{title}</h3>
      <p style={{ margin: '2px 0 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>{subtitle}</p>
      {children}
    </div>
  );
}
