import { useId } from 'react';
import type { JudgeBreakdown } from '../../types';
import { DIMENSIONS, DIMENSION_ORDER } from '../../data/dimensionTheme';
import { svgId } from '../art/random';

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
const VB = { x: -64, y: -8, w: 358, h: 232 };
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

/** Label anchor just outside each axis tip (pt() clamps to the outer ring, so compute directly). */
function labelPos(i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
  const px = C + R * 1.16 * Math.cos(angle);
  const py = C + R * 1.16 * Math.sin(angle);
  const x = px;
  const y = py + (py < C - 20 ? -3 : py > C + 20 ? 7 : 0);
  const anchor = Math.abs(px - C) < 6 ? 'middle' : px < C ? 'end' : 'start';
  return { x, y, anchor };
}

/**
 * "Your writing shape" — a 5-axis radar with this piece drawn over the writer's
 * usual shape, so growth and lopsidedness are visible at a glance. Pure SVG.
 */
export function WritingShapeRadar({ current, baseline, size = 330 }: Props) {
  const id = svgId(useId());
  const rings = [10, 7.5, 5, 2.5];

  return (
    <svg
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      width={size}
      height={Math.round((size * VB.h) / VB.w)}
      role="img"
      aria-label="Your writing shape across the five skills"
      className="mx-auto block max-w-full"
    >
      <defs>
        <radialGradient id={`${id}-fill`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#F7D88D" stopOpacity="0.55" />
          <stop offset="1" stopColor="#DE9F2C" stopOpacity="0.32" />
        </radialGradient>
      </defs>
      {rings.map((rv, idx) => (
        <polygon
          key={idx}
          points={DIMENSION_ORDER.map((_, i) => pt(i, rv).join(',')).join(' ')}
          fill={idx % 2 === 0 ? '#F4ECDD' : '#FBF5EA'}
          fillOpacity={0.9}
          stroke="#D6C5A7"
          strokeOpacity={0.7}
          strokeWidth={1}
        />
      ))}
      {DIMENSION_ORDER.map((d, i) => {
        const [x, y] = pt(i, 10);
        return <line key={d} x1={C} y1={C} x2={x} y2={y} stroke="#D6C5A7" strokeOpacity={0.8} strokeWidth={1} />;
      })}

      {baseline && (
        <polygon points={polygon(baseline)} fill="#3B4266" fillOpacity={0.08} stroke="#3B4266" strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" />
      )}

      <polygon
        points={polygon(current)}
        fill={`url(#${id}-fill)`}
        stroke="#C98A1C"
        strokeWidth={2.4}
        strokeLinejoin="round"
        style={{ transition: 'all 0.6s cubic-bezier(0.2,0.8,0.2,1)' }}
      />
      {DIMENSION_ORDER.map((d, i) => {
        const [x, y] = pt(i, current[d]);
        return <circle key={`v-${d}`} cx={x} cy={y} r={4} fill={DIMENSIONS[d].color} stroke="#FFFFFF" strokeWidth={1.8} />;
      })}

      {DIMENSION_ORDER.map((d, i) => {
        const theme = DIMENSIONS[d];
        const { x, y, anchor } = labelPos(i);
        return (
          <text
            key={`lbl-${d}`}
            x={x}
            y={y}
            fontSize={12.5}
            fontWeight={750}
            fill="#3B4266"
            textAnchor={anchor}
            dominantBaseline="middle"
            fontFamily="'Figtree Variable', system-ui, sans-serif"
          >
            {theme.label}
          </text>
        );
      })}
    </svg>
  );
}
