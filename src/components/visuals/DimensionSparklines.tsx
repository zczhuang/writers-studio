import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Entry } from '../../types';
import { DIMENSIONS, DIMENSION_ORDER } from '../../data/dimensionTheme';
import { toneVars } from '../../data/tones';
import { dimensionSeries, trendOf } from '../../services/writerMemory';

interface Props {
  entries: Entry[];
  /** How many recent pieces to chart. */
  window?: number;
  /** Stacked rows for narrow columns. */
  compact?: boolean;
}

const W = 100;
const H = 30;

function yFor(value: number): number {
  return H - (Math.max(0, Math.min(10, value)) / 10) * (H - 6) - 3;
}

function linePath(series: number[]): string {
  if (series.length === 0) return '';
  if (series.length === 1) return `M0,${yFor(series[0]).toFixed(1)} L${W},${yFor(series[0]).toFixed(1)}`;
  const step = W / (series.length - 1);
  return series.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${yFor(value).toFixed(1)}`).join(' ');
}

const TREND = {
  climbing: { label: 'Climbing', Icon: TrendingUp },
  steady: { label: 'Steady', Icon: Minus },
  dipping: { label: 'Dipping', Icon: TrendingDown },
} as const;

/** Five trend lines, one per grading dimension, over recent pieces. */
export function DimensionSparklines({ entries, window = 8, compact = false }: Props) {
  const series = dimensionSeries(entries, window);
  if (DIMENSION_ORDER.every((dimension) => series[dimension].length === 0)) {
    return <p className="ws-small">Skill trends need graded writing. Recovered pieces with unavailable grades are still kept in Journal.</p>;
  }

  return (
    <div className={`ws-skill-rows ${compact ? 'is-compact' : ''}`}>
      {DIMENSION_ORDER.map((dimension) => {
        const theme = DIMENSIONS[dimension];
        const Glyph = theme.Glyph;
        const data = series[dimension];
        const latest = data.length ? data[data.length - 1] : null;
        const trend = TREND[trendOf(data)];
        const line = linePath(data);
        return (
          <div key={dimension} className="ws-skill-row" style={toneVars(dimension)}>
            <span className="ws-skill-name"><Glyph size={16} aria-hidden="true" /><span>{theme.kidLabel}</span></span>
            <span className="ws-skill-spark" aria-hidden="true">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                {line && <path d={`${line} L${W},${H} L0,${H} Z`} fill={theme.color} fillOpacity={0.12} />}
                {line && <path d={line} fill="none" stroke={theme.color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
              </svg>
              {latest !== null && <i className="ws-skill-dot" style={{ top: `${((yFor(latest) / H) * 100).toFixed(1)}%`, background: theme.color }} />}
            </span>
            <span className="ws-skill-value" aria-label={`${theme.label} latest score`}>{latest ?? '—'}</span>
            <span className={`ws-skill-trend is-${trendOf(data)}`}>
              {latest === null ? 'No grades' : <><trend.Icon size={14} aria-hidden="true" /> {trend.label}</>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
