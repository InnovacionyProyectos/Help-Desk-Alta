import { useState } from 'react';

export interface DonutChartItem {
  label: string;
  value: number;
  color: string;
}

const SIZE = 160;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

// Donut vía stroke-dasharray por segmento: cada categoría es su propio
// <circle>, así puede tener su propio hover/tooltip sin math de arcos SVG.
export function DonutChart({ items }: { items: DonutChartItem[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin datos</p>;
  }

  let cumulative = 0;
  const segments = items.map((item) => {
    const fraction = item.value / total;
    const segmentLength = fraction * CIRCUMFERENCE;
    const gap = items.length > 1 ? GAP : 0;
    const visibleLength = Math.max(segmentLength - gap, 0.001);
    const dashOffset = -(cumulative + gap / 2);
    cumulative += segmentLength;
    return { ...item, fraction, visibleLength, dashOffset };
  });

  const center = hovered !== null ? segments[hovered] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {segments.map((seg, i) => (
            <circle
              key={seg.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={hovered === i ? STROKE + 4 : STROKE}
              strokeDasharray={`${seg.visibleLength} ${CIRCUMFERENCE - seg.visibleLength}`}
              strokeDashoffset={seg.dashOffset}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ stroke: seg.color, cursor: 'pointer', transition: 'stroke-width 120ms' }}
            />
          ))}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
            padding: 8,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
            {center ? center.value : total}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              maxWidth: SIZE - STROKE * 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {center ? `${center.label} · ${Math.round(center.fraction * 100)}%` : 'Total'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 180 }}>
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: 'var(--color-bg)',
              borderRadius: 6,
              padding: '8px 10px',
              cursor: 'pointer',
              opacity: hovered === null || hovered === i ? 1 : 0.55,
              transition: 'opacity 120ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: 'var(--color-text)', flex: 1 }}>{seg.label}</span>
              <strong style={{ color: 'var(--color-text)' }}>{seg.value}</strong>
              <span style={{ color: 'var(--color-text-muted)', width: 42, textAlign: 'right' }}>
                {(seg.fraction * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 4 }}>
              <div
                style={{
                  width: `${seg.fraction * 100}%`,
                  background: seg.color,
                  height: 4,
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
