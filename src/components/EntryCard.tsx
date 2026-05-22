import type { Entry } from '../types';
import { tierLabel } from '../services/scoring';
import { MODE_META } from '../data/prompts';
import { prettyDate } from '../utils/date';

interface Props {
  entry: Entry;
  onClick?: () => void;
}

const TIER_TEXT_CLASS: Record<string, string> = {
  none: 'text-text-faint',
  bronze: 'text-tier-bronze',
  silver: 'text-tier-silver',
  gold: 'text-tier-gold',
  platinum: 'text-tier-platinum',
};

export function EntryCard({ entry, onClick }: Props) {
  const meta = MODE_META[entry.mode];
  const preview = entry.text.length > 180 ? entry.text.slice(0, 180).trimEnd() + '…' : entry.text;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface border border-white/5 rounded-xl p-4 hover:border-gold/30 transition-colors"
    >
      <div className="flex items-center justify-between text-caption mb-2">
        <span className="text-text-muted font-medium">{meta.label} · {entry.challengeTitle}</span>
        <span className="text-text-faint">{prettyDate(entry.createdAt)}</span>
      </div>
      <p className="font-serif text-body text-text mb-3 line-clamp-3">{preview}</p>
      <div className="flex items-center gap-3 text-caption">
        <span className={`font-semibold ${TIER_TEXT_CLASS[entry.judge.tier]}`}>{tierLabel(entry.judge.tier)}</span>
        <span className="text-text-faint">·</span>
        <span className="text-text-muted tabular-nums">{entry.judge.score}/100</span>
        <span className="text-text-faint">·</span>
        <span className="text-text-muted tabular-nums">{entry.wordCount} words</span>
      </div>
    </button>
  );
}
