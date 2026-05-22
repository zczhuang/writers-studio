interface Props {
  count: number;
  target: [number, number];
}

export function WordCounter({ count, target }: Props) {
  const [min, max] = target;
  let status: 'low' | 'on' | 'over' = 'low';
  if (count >= min && count <= max) status = 'on';
  else if (count > max) status = 'over';

  const colors = {
    low: 'text-ink-muted border-ink-muted/30 bg-paper-edge/60',
    on: 'text-moss border-moss/50 bg-moss/15',
    over: 'text-gold-deep border-gold-deep/50 bg-gold/20',
  }[status];

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-caption font-semibold tabular-nums ${colors}`}>
      <span>{count}</span>
      <span className="text-ink-muted/70">/</span>
      <span className="text-ink-muted/70">{min}–{max}</span>
    </div>
  );
}
