interface Props {
  pct: number;
  height?: number;
  variant?: 'gold' | 'teal' | 'rust';
  label?: string;
}

export function ProgressBar({ pct, height = 8, variant = 'gold', label = 'Progress' }: Props) {
  const color = {
    gold: 'bg-gradient-to-r from-gold-deep via-gold to-gold-bright',
    teal: 'bg-teal',
    rust: 'bg-rust',
  }[variant];
  const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;

  return (
    <div
      className="w-full bg-surface-2 rounded-full overflow-hidden"
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safePct)}
    >
      <div className={`h-full ${color} transition-[width] duration-700 ease-out`} style={{ width: `${safePct}%` }} />
    </div>
  );
}
