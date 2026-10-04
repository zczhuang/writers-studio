import type { CSSProperties, ReactNode } from 'react';

interface Props {
  pct: number;
  size?: number;
  stroke?: number;
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Circular progress that sweeps in on mount. Color comes from the surrounding `--tone`. */
export function ProgressRing({ pct, size = 56, stroke = 6, label, children, className = '', style }: Props) {
  const safe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe / 100);
  const center = size / 2;
  return (
    <span
      className={`ws-ring-wrap ${className}`}
      style={{ width: size, height: size, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg className="ws-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="ws-ring-track" cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ws-ring-fill"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ '--ring-circ': circumference.toFixed(2) } as CSSProperties}
        />
      </svg>
      {children !== undefined && <span className="ws-ring-center">{children}</span>}
    </span>
  );
}
