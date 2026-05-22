import { useMemo, useState } from 'react';
import { BookOpen, Quote } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { EntryCard } from '../components/EntryCard';
import { Modal } from '../components/ui/Modal';
import { MODE_META } from '../data/prompts';
import type { Mode } from '../types';
import { tierLabel } from '../services/scoring';
import { prettyDate } from '../utils/date';

const TIER_TEXT: Record<string, string> = {
  none: 'text-text-faint',
  bronze: 'text-tier-bronze',
  silver: 'text-tier-silver',
  gold: 'text-tier-gold',
  platinum: 'text-tier-platinum',
};

export function JournalScreen() {
  const { state } = useApp();
  const [filter, setFilter] = useState<'all' | Mode>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = [...state.entries].reverse();
    return filter === 'all' ? list : list.filter((e) => e.mode === filter);
  }, [state.entries, filter]);

  const entry = openId ? state.entries.find((e) => e.id === openId) : null;

  return (
    <div className="space-y-4 animate-slide-up">
      <header>
        <h1 className="font-display text-h1 font-semibold text-text">Journal</h1>
        <p className="text-text-muted text-caption mt-1">Every piece you've written, in one place.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <Chip label="All" active={filter === 'all'} onClick={() => setFilter('all')} count={state.entries.length} />
        {(Object.keys(MODE_META) as Mode[]).map((m) => (
          <Chip
            key={m}
            label={MODE_META[m].label}
            active={filter === m}
            onClick={() => setFilter(m)}
            count={state.entries.filter((e) => e.mode === m).length}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-text-muted">
          <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-caption">No pieces yet — your first one will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <EntryCard key={e.id} entry={e} onClick={() => setOpenId(e.id)} />
          ))}
        </div>
      )}

      <Modal open={!!entry} onClose={() => setOpenId(null)} title={entry?.challengeTitle}>
        {entry && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-caption">
              <span className="text-text-muted">{MODE_META[entry.mode].label}</span>
              <span className="text-text-faint">{prettyDate(entry.createdAt)}</span>
            </div>
            <div className="flex items-center gap-3 text-caption">
              <span className={`font-semibold ${TIER_TEXT[entry.judge.tier]}`}>{tierLabel(entry.judge.tier)}</span>
              <span className="text-text-faint">·</span>
              <span className="text-text-muted tabular-nums">{entry.judge.score}/100</span>
              <span className="text-text-faint">·</span>
              <span className="text-text-muted tabular-nums">{entry.wordCount} words</span>
            </div>
            <p className="text-caption text-text-faint italic">{entry.prompt}</p>
            <hr className="border-white/8" />
            <p className="font-serif text-body text-text whitespace-pre-wrap leading-relaxed">{entry.text}</p>
            {entry.judge.celebrate && (
              <div className="bg-gold/10 border border-gold/25 rounded-lg p-3 flex items-start gap-2">
                <Quote size={14} className="text-gold mt-0.5 shrink-0" />
                <p className="font-serif italic text-caption text-text">"{entry.judge.celebrate}."</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Chip({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-caption font-medium border transition-colors ${
        active
          ? 'bg-gold text-ink border-gold'
          : 'bg-surface text-text-muted border-white/8 hover:border-white/15'
      }`}
    >
      {label} <span className="opacity-70 ml-1">{count}</span>
    </button>
  );
}
