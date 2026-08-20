const PLOT_HEIGHT = 180;
const TICK_COUNT = 4;

function niceStep(maxValue: number): number {
  if (maxValue <= 0) return 1;
  const rawStep = maxValue / TICK_COUNT;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export interface BarChartItem {
  label: string;
  value: number;
}

// Barras verticales con valor sobre la barra y líneas de referencia
// horizontales — para comparar magnitud entre categorías (área, categoría,
// prioridad), a diferencia del donut que es para "parte de un todo".
export function BarChart({ items, color }: { items: BarChartItem[]; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const step = niceStep(max);
  const niceMax = step * TICK_COUNT;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => step * (TICK_COUNT - i));

  return (
    <div>
      <div style={{ display: 'flex', height: PLOT_HEIGHT }}>
        <div style={{ position: 'relative', width: 30, flexShrink: 0 }}>
          {ticks.map((tick, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                top: `${(i / TICK_COUNT) * 100}%`,
                right: 6,
                transform: 'translateY(-50%)',
                fontSize: 10,
                color: 'var(--color-text-muted)',
              }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1 }}>
          {ticks.map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${(i / TICK_COUNT) * 100}%`,
                left: 0,
                right: 0,
                borderTop: '1px dashed var(--color-border)',
              }}
            />
          ))}

          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 4px' }}>
            {items.map((item) => {
              const barHeight = Math.max(2, (item.value / niceMax) * (PLOT_HEIGHT - 20));
              return (
                <div
                  key={item.label}
                  title={`${item.label}: ${item.value}`}
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                    {item.value}
                  </span>
                  <div
                    style={{
                      width: '60%',
                      maxWidth: 28,
                      height: barHeight,
                      background: color,
                      borderRadius: '3px 3px 0 0',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginLeft: 30, padding: '6px 4px 0' }}>
        {items.map((item) => (
          <div
            key={item.label}
            title={item.label}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 10,
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
