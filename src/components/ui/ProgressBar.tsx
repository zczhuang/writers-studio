import type { CSSProperties } from 'react';
import { toneVars, type ToneName } from '../../data/tones';

interface Props {
  pct: number;
  tone?: ToneName;
  /** Legacy variants map onto tones. */
  variant?: 'gold' | 'teal' | 'rust';
  thin?: boolean;
  label?: string;
  style?: CSSProperties;
}

const VARIANT_TONE: Record<NonNullable<Props['variant']>, ToneName> = {
  gold: 'gold',
  teal: 'scene',
  rust: 'danger',
};

export function ProgressBar({ pct, tone, variant = 'gold', thin, label = 'Progress', style }: Props) {
  const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const resolved = tone ?? VARIANT_TONE[variant];
  return (
    <div
      className={`ws-progress ${thin ? 'ws-progress--thin' : ''} ${resolved === 'gold' ? 'ws-progress--gold' : ''}`}
      style={{ ...toneVars(resolved), ...style }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safePct)}
    >
      <span style={{ width: `${safePct}%` }} />
    </div>
  );
}
