interface Props {
  pct: number;
  height?: number;
  variant?: 'gold' | 'teal' | 'rust';
}

export function ProgressBar({ pct, height = 8, variant = 'gold' }: Props) {
  const color = {
    gold: 'bg-gradient-to-r from-gold-deep via-gold to-gold-bright',
    teal: 'bg-teal',
    rust: 'bg-rust',
  }[variant];

  return (
    <div className="w-full bg-surface-2 rounded-full overflow-hidden" style={{ height }}>
      <div className={`h-full ${color} transition-[width] duration-700 ease-out`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
