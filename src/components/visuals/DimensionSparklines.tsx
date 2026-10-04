import type { Entry } from '../../types';
import { DIMENSIONS, DIMENSION_ORDER } from '../../data/dimensionTheme';
import { dimensionSeries, trendOf } from '../../services/writerMemory';

interface Props {
  entries: Entry[];
  /** How many recent pieces to chart. */
  window?: number;
}

const W = 88;
const H = 26;

function path(series: number[]): string {
  if (series.length === 0) return '';
  if (series.length === 1) return `M0,${H / 2} L${W},${H / 2}`;
  const max = 10;
  const step = W / (series.length - 1);
  return series
    .map((v, i) => {
      const x = i * step;
      const y = H - (Math.max(0, Math.min(max, v)) / max) * (H - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

const TREND_LABEL: Record<ReturnType<typeof trendOf>, string> = {
  climbing: 'climbing',
  steady: 'steady',
  dipping: 'dipping',
};

/** Five small trend lines — one per grading dimension — over recent pieces. */
export function DimensionSparklines({ entries, window = 8 }: Props) {
  const series = dimensionSeries(entries, window);

  return (
    <div className="space-y-2">
      {DIMENSION_ORDER.map((d) => {
        const theme = DIMENSIONS[d];
        const Glyph = theme.Glyph;
        const data = series[d];
        const latest = data.length ? data[data.length - 1] : 0;
        const trend = trendOf(data);
        return (
          <div key={d} className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 w-28 shrink-0">
              <Glyph size={13} style={{ color: theme.color }} />
              <span className="text-caption text-text-muted truncate">{theme.label}</span>
            </span>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0" aria-hidden>
              <path d={path(data)} fill="none" stroke={theme.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {data.length > 0 && (
                <circle
                  cx={W}
                  cy={H - (Math.max(0, Math.min(10, latest)) / 10) * (H - 4) - 2}
                  r={2.5}
                  fill={theme.color}
                />
              )}
            </svg>
            <span className="font-mono text-caption text-text tabular-nums w-6 text-right">{latest}</span>
            <span className="text-micro uppercase tracking-wide text-text-faint w-16 hidden sm:inline">{TREND_LABEL[trend]}</span>
          </div>
        );
      })}
    </div>
  );
}
