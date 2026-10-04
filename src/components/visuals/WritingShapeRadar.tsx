import type { JudgeBreakdown } from '../../types';
import { DIMENSIONS, DIMENSION_ORDER } from '../../data/dimensionTheme';

interface Props {
  /** This piece's scores (0–10). */
  current: JudgeBreakdown;
  /** The writer's usual shape — average of prior pieces (0–10). Omit to hide. */
  baseline?: JudgeBreakdown;
  size?: number;
}

const C = 115; // geometric centre
const R = 80; // outer ring radius
// viewBox is padded (and non-square) so long axis labels never clip.
const VB = { x: -24, y: -14, w: 278, h: 258 };
const N = DIMENSION_ORDER.length;

/** Point on the pentagon for axis `i` at a 0–10 `value`. */
function pt(i: number, value: number): [number, number] {
  const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
  const r = (Math.max(0, Math.min(10, value)) / 10) * R;
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
}

function polygon(values: JudgeBreakdown): string {
  return DIMENSION_ORDER.map((d, i) => pt(i, values[d]).join(',')).join(' ');
}

/** Label anchor pulled inward from the vertex so words stay within the viewBox. */
function labelPos(i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const [px, py] = pt(i, 11);
  const x = C + (px - C) * 0.82;
  const y = C + (py - C) * 0.92;
  const anchor = Math.abs(px - C) < 6 ? 'middle' : px < C ? 'end' : 'start';
  return { x, y, anchor };
}

/**
 * "Your writing shape" — a 5-axis radar with this piece drawn over the writer's
 * usual shape, so growth and lopsidedness are visible at a glance. Pure SVG.
 */
export function WritingShapeRadar({ current, baseline, size = 240 }: Props) {
  const rings = [10, 6.66, 3.33];

  return (
    <svg
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      width={size}
      height={Math.round((size * VB.h) / VB.w)}
      role="img"
      aria-label="Your writing shape across the five skills"
      className="mx-auto block"
    >
      {/* grid rings */}
      {rings.map((rv, idx) => (
        <polygon
          key={idx}
          points={DIMENSION_ORDER.map((_, i) => pt(i, rv).join(',')).join(' ')}
          fill="none"
          stroke="var(--text-faint)"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
      ))}
      {/* axes */}
      {DIMENSION_ORDER.map((d, i) => {
        const [x, y] = pt(i, 10);
        return <line key={d} x1={C} y1={C} x2={x} y2={y} stroke="var(--text-faint)" strokeOpacity={0.2} strokeWidth={1} />;
      })}

      {/* baseline (usual shape) */}
      {baseline && (
        <polygon points={polygon(baseline)} fill="var(--text-muted)" fillOpacity={0.12} stroke="var(--text-muted)" strokeOpacity={0.5} strokeWidth={1.5} />
      )}

      {/* current piece */}
      <polygon
        points={polygon(current)}
        fill="var(--gold)"
        fillOpacity={0.22}
        stroke="var(--gold)"
        strokeWidth={2}
        style={{ transition: 'all 0.6s cubic-bezier(0.2,0.8,0.2,1)' }}
      />

      {/* axis labels with dimension dots */}
      {DIMENSION_ORDER.map((d, i) => {
        const theme = DIMENSIONS[d];
        const [dotX, dotY] = pt(i, 10.4);
        const { x, y, anchor } = labelPos(i);
        return (
          <g key={`lbl-${d}`}>
            <circle cx={dotX} cy={dotY} r={2.5} fill={theme.color} />
            <text
              x={x}
              y={y}
              fontSize={8.5}
              fontWeight={600}
              fill="var(--text-muted)"
              textAnchor={anchor}
              dominantBaseline="middle"
              style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}
            >
              {theme.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
