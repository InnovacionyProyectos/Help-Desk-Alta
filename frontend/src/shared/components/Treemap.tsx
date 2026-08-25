export interface TreemapItem {
  label: string;
  value: number;
  color: string;
}

interface Rect extends TreemapItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Slice-and-dice recursivo: en cada nivel corta la lista donde se acumula
// la mitad del valor y reparte el rectángulo en esa proporción, alternando
// eje horizontal/vertical — un treemap simple, sin depender de librerías.
function layout(items: TreemapItem[], x: number, y: number, w: number, h: number, horizontal: boolean): Rect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];

  const total = items.reduce((sum, i) => sum + i.value, 0);
  let acc = 0;
  let splitIndex = 1;
  for (let i = 0; i < items.length; i++) {
    acc += items[i].value;
    if (acc >= total / 2) {
      splitIndex = i + 1;
      break;
    }
  }
  splitIndex = Math.min(Math.max(splitIndex, 1), items.length - 1);

  const left = items.slice(0, splitIndex);
  const right = items.slice(splitIndex);
  const leftFraction = left.reduce((sum, i) => sum + i.value, 0) / total;

  if (horizontal) {
    const wLeft = w * leftFraction;
    return [
      ...layout(left, x, y, wLeft, h, false),
      ...layout(right, x + wLeft, y, w - wLeft, h, false),
    ];
  }
  const hTop = h * leftFraction;
  return [
    ...layout(left, x, y, w, hTop, true),
    ...layout(right, x, y + hTop, w, h - hTop, true),
  ];
}

// Función de luminancia relativa (WCAG) para elegir texto blanco o negro
// según qué tan clara sea la celda, en vez de fijar un color de antemano.
function readableTextColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [rl, gl, bl] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  return luminance > 0.5 ? '#0b0b0b' : '#ffffff';
}

const HEIGHT = 280;

export function Treemap({ items }: { items: TreemapItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin datos</p>;
  }

  const rects = layout(items, 0, 0, 100, HEIGHT, true);

  return (
    <div style={{ position: 'relative', width: '100%', height: HEIGHT }}>
      {rects.map((r) => {
        const textColor = readableTextColor(r.color);
        const showLabel = r.w > 12 && r.h > 30;
        const showValue = r.w > 30 && r.h > 50;
        return (
          <div
            key={r.label}
            title={`${r.label}: ${r.value}`}
            style={{
              position: 'absolute',
              left: `${r.x}%`,
              top: r.y,
              width: `${r.w}%`,
              height: r.h,
              background: r.color,
              border: '2px solid var(--color-surface)',
              boxSizing: 'border-box',
              padding: 8,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            {showLabel && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: textColor,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.label}
              </span>
            )}
            {showValue && (
              <span style={{ fontSize: 20, fontWeight: 700, color: textColor, lineHeight: 1.2 }}>
                {r.value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
