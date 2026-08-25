export interface WaffleChartItem {
  label: string;
  value: number;
  color: string;
}

// Mosaico de 100 cuadros (1 cuadro = 1%) — visualmente muy distinto a un
// donut para "parte de un todo", útil sobre todo con pocas categorías.
export function WaffleChart({ items }: { items: WaffleChartItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin datos</p>;
  }

  // Reparte 100 cuadros por fracción exacta, y da el residuo de redondeo
  // a la categoría más grande para que la suma siempre dé 100.
  const raw = items.map((item) => (item.value / total) * 100);
  const counts = raw.map((n) => Math.floor(n));
  const remainder = 100 - counts.reduce((sum, n) => sum + n, 0);
  const order = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) counts[order[k % order.length].i] += 1;

  const cells: string[] = [];
  items.forEach((item, i) => {
    for (let c = 0; c < counts[i]; c++) cells.push(item.color);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 1fr)',
          gap: 3,
          maxWidth: 220,
          margin: '0 auto',
        }}
      >
        {cells.map((color, i) => (
          <div key={i} style={{ aspectRatio: '1', borderRadius: 2, background: color }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{ width: 12, height: 12, borderRadius: 3, background: item.color, flexShrink: 0 }}
            />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>
              {item.label}
            </span>
            <strong style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</strong>
            <span style={{ width: 40, textAlign: 'right', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {Math.round((item.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
