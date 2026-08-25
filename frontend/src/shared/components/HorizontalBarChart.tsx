export interface HorizontalBarChartItem {
  label: string;
  value: number;
}

// Barras horizontales con relleno degradado — ideal para muchas categorías
// o etiquetas largas (no hay que truncar ni rotar texto), y el degradado le
// da profundidad frente a un relleno plano.
export function HorizontalBarChart({ items, color }: { items: HorizontalBarChartItem[]; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((item) => {
        const pct = (item.value / max) * 100;
        return (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              title={item.label}
              style={{
                width: 130,
                flexShrink: 0,
                fontSize: 13,
                color: 'var(--color-text-muted)',
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
            <div style={{ flex: 1, height: 22, background: 'var(--color-bg)', borderRadius: 999 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  minWidth: 6,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, white), ${color})`,
                }}
              />
            </div>
            <strong style={{ width: 34, flexShrink: 0, fontSize: 14, fontWeight: 700, color }}>
              {item.value}
            </strong>
          </div>
        );
      })}
    </div>
  );
}
