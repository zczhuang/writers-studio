import { useMemo, useState, type CSSProperties } from 'react';
import { BookMarked, Feather, History, Quote } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { EntryCard } from '../components/EntryCard';
import { Modal } from '../components/ui/Modal';
import { TierChip } from '../components/TierChip';
import { MODE_META } from '../data/prompts';
import { MODE_THEME } from '../data/modeTheme';
import { toneVars } from '../data/tones';
import type { EntryVersion, Mode } from '../types';
import { prettyDate } from '../utils/date';
import { gradingPresentation } from '../services/gradingPresentation';

export function JournalScreen() {
  const { state } = useApp();
  const [filter, setFilter] = useState<'all' | Mode>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [openVersionId, setOpenVersionId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = [...state.entries].reverse();
    return filter === 'all' ? list : list.filter((e) => e.mode === filter);
  }, [state.entries, filter]);

  const entry = openId ? state.entries.find((e) => e.id === openId) : null;
  const versions = entry?.versions ?? [];
  const selectedVersion = versions.find((version) => version.id === openVersionId)
    ?? versions.find((version) => version.id === entry?.currentVersionId)
    ?? null;
  const displayedGrade = entry
    ? gradingPresentation(selectedVersion ?? entry)
    : null;
  const displayedJudge = selectedVersion?.judge ?? entry?.judge;
  const totalWords = state.entries.reduce((sum, item) => sum + item.wordCount, 0);

  return (
    <div className="ws-page">
      <header className="ws-page-head ws-rise">
        <div>
          <p className="ws-kicker"><BookMarked size={14} aria-hidden="true" /> Every page, kept safe</p>
          <h1 className="ws-h1">Journal</h1>
          <p className="ws-lede">Every piece you&apos;ve written, with each draft along the way.</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="font-display text-[2rem] font-semibold leading-none tabular-nums">{state.entries.length}</div>
            <div className="mt-1 text-[0.8rem] font-bold text-text-muted">pieces</div>
          </div>
          <div>
            <div className="font-display text-[2rem] font-semibold leading-none tabular-nums">{totalWords.toLocaleString()}</div>
            <div className="mt-1 text-[0.8rem] font-bold text-text-muted">words</div>
          </div>
        </div>
      </header>

      <div className="ws-filter-row ws-rise" style={{ '--i': 1 } as CSSProperties} role="group" aria-label="Filter by world">
        <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} count={state.entries.length} />
        {(Object.keys(MODE_META) as Mode[]).map((m) => {
          const Icon = MODE_THEME[m].Icon;
          return (
            <FilterChip
              key={m}
              label={MODE_META[m].label}
              icon={<Icon size={15} aria-hidden="true" />}
              active={filter === m}
              onClick={() => setFilter(m)}
              count={state.entries.filter((e) => e.mode === m).length}
              style={toneVars(m)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="ws-empty">
          <Feather size={34} aria-hidden="true" />
          <h2 className="ws-h3">{filter === 'all' ? 'Your journal is waiting' : `No ${MODE_META[filter].label.toLowerCase()} pieces yet`}</h2>
          <p>Your first piece will appear here, along with every revision you make.</p>
        </div>
      ) : (
        <div className="ws-journal-grid ws-rise" style={{ '--i': 2 } as CSSProperties}>
          {filtered.map((e) => (
            <EntryCard key={e.id} entry={e} onClick={() => { setOpenId(e.id); setOpenVersionId(e.currentVersionId ?? null); }} />
          ))}
        </div>
      )}

      <Modal
        open={!!entry}
        onClose={() => { setOpenId(null); setOpenVersionId(null); }}
        title={entry?.challengeTitle}
        eyebrow={entry ? <>{MODE_META[entry.mode].label} · {prettyDate(entry.createdAt)}</> : undefined}
      >
        {entry && displayedJudge && (
          <div className="grid gap-4" style={toneVars(entry.mode)}>
            <div className="ws-reader-meta">
              <TierChip tier={displayedGrade?.available ? displayedJudge.tier : 'none'} label={displayedGrade?.tierText ?? ''} />
              {displayedGrade?.available && <span className="ws-chip" style={toneVars('neutral')}>{displayedGrade.scoreText}</span>}
              <span className="ws-chip" style={toneVars('neutral')}>{selectedVersion?.wordCount ?? entry.wordCount} words</span>
            </div>
            {versions.length > 1 && (
              <div className="ws-versions">
                <div className="ws-kicker"><History size={14} aria-hidden="true" /> Draft history</div>
                <div className="flex flex-wrap gap-2">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => setOpenVersionId(version.id)}
                      className={`ws-version-btn ${selectedVersion?.id === version.id ? 'is-active' : ''}`}
                      aria-pressed={selectedVersion?.id === version.id}
                    >
                      {versionLabel(version)}
                    </button>
                  ))}
                </div>
                <p className="ws-small mt-2 mb-0">Earlier drafts are read-only. Keeping them does not award rewards again.</p>
              </div>
            )}
            <p className="ws-reader-prompt">{entry.prompt}</p>
            <p className="ws-reader-text">{selectedVersion?.text ?? entry.text}</p>
            {displayedJudge.celebrate && (
              <div className="ws-callout ws-callout--info">
                <Quote size={16} aria-hidden="true" />
                <span className="ws-read italic">&ldquo;{displayedJudge.celebrate}.&rdquo;</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function versionLabel(version: EntryVersion): string {
  if (version.kind === 'first-draft') return 'First draft';
  if (version.kind === 'legacy-current') return version.revision > 0 ? `Recovered draft · revision ${version.revision}` : 'Recovered draft';
  if (version.kind === 'conflict') return `Other revision ${version.revision}`;
  return `Revision ${version.revision}`;
}

function FilterChip({ label, active, onClick, count, icon, style }: { label: string; active: boolean; onClick: () => void; count: number; icon?: React.ReactNode; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} className={`ws-filter ${active ? 'is-active' : ''}`} aria-pressed={active} style={style}>
      {icon}
      {label}
      <span className="ws-filter-count">{count}</span>
    </button>
  );
}
