export interface SegmentedMeterItem {
  label: string;
  value: number;
  color: string;
}

// Una sola barra ancha dividida en tramos proporcionales — variante de
// "parte de un todo" muy distinta a un donut: más un medidor de estado que
// un gráfico circular, con separadores blancos entre tramos.
export function SegmentedMeter({ items }: { items: SegmentedMeterItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin datos</p>;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 3,
          height: 44,
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--color-bg)',
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            title={`${item.label}: ${item.value}`}
            style={{ flex: item.value, minWidth: 4, background: item.color }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: 18 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{item.label}</span>
            <strong style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</strong>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              ({Math.round((item.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
