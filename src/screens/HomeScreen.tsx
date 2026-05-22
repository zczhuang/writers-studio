import { Flame, Coins, PenLine, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useApp } from '../state/AppContext';
import { MODE_META, POOLS } from '../data/prompts';
import { StatCard } from '../components/StatCard';
import { EntryCard } from '../components/EntryCard';
import { getLevel, levelProgress } from '../data/levels';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useDailyCap } from '../hooks/useDailyCap';
import type { Mode } from '../types';

const MODE_ORDER: Mode[] = ['scene', 'story', 'mystery', 'upgrade'];

export function HomeScreen() {
  const { state, dispatch } = useApp();
  const { writer, entries } = state;
  const lvl = levelProgress(writer.xp);
  const cap = useDailyCap();
  const recent = [...entries].reverse().slice(0, 3);
  const LevelIcon = (Icons as unknown as Record<string, Icons.LucideIcon>)[getLevel(writer.xp).icon] ?? PenLine;

  const goMode = (mode: Mode) => {
    dispatch({ type: 'PICK_MODE', mode });
    dispatch({ type: 'NAV', screen: 'mode-list' });
  };

  return (
    <div className="space-y-7 animate-slide-up">
      <section>
        <p className="text-caption text-text-faint font-medium uppercase tracking-wider mb-1">Welcome back</p>
        <h1 className="font-display text-display font-semibold text-text leading-none mb-1">
          {writer.name}
        </h1>
        <p className="font-serif italic text-text-muted">
          {writer.totalChallenges === 0
            ? 'Your first page is waiting.'
            : 'The page is open. What will you write today?'}
        </p>
      </section>

      <section className="flex gap-3">
        <StatCard
          label="Streak"
          icon={<Flame size={12} className="text-rust" />}
          value={`${writer.streak}d`}
        />
        <StatCard
          label="Words"
          icon={<PenLine size={12} className="text-teal" />}
          value={writer.totalWords.toLocaleString()}
        />
        <StatCard
          label="Pending"
          icon={<Coins size={12} className="text-gold" />}
          value={`$${state.earnings.lifetimePending.toFixed(2)}`}
        />
      </section>

      <section className="bg-surface border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LevelIcon size={16} className="text-gold" />
            <span className="font-display text-h3 font-semibold text-text">{lvl.level.name}</span>
          </div>
          <span className="font-mono text-caption text-text-muted tabular-nums">{writer.xp} xp</span>
        </div>
        <ProgressBar pct={lvl.pct} />
      </section>

      {cap.capHit && (
        <section className="bg-rust/10 border border-rust/30 rounded-xl p-4 text-caption text-text">
          <span className="font-semibold text-rust">Daily cap reached.</span> You can still write and grow — tomorrow's a fresh start.
        </section>
      )}

      <section>
        <h2 className="font-display text-h2 font-semibold text-text mb-3">Pick a challenge</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODE_ORDER.map((m) => {
            const meta = MODE_META[m];
            const ModeIcon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? PenLine;
            const completed = state.entries.filter((e) => e.mode === m).length;
            const total = POOLS[m].length;
            return (
              <button
                key={m}
                onClick={() => goMode(m)}
                className="text-left bg-surface border border-white/5 rounded-xl p-4 hover:border-gold/30 transition-colors group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-gold/15 text-gold rounded-lg p-1.5">
                      <ModeIcon size={18} />
                    </span>
                    <span className="font-display text-h3 font-semibold text-text">{meta.label}</span>
                  </div>
                  <ChevronRight size={16} className="text-text-faint group-hover:text-gold transition-colors" />
                </div>
                <p className="text-caption text-text-muted leading-snug mb-2">{meta.tagline}</p>
                <p className="text-micro text-text-faint uppercase tracking-wider">
                  {completed}/{total} written
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="font-display text-h2 font-semibold text-text mb-3">Recent work</h2>
          <div className="space-y-3">
            {recent.map((e) => (
              <EntryCard key={e.id} entry={e} onClick={() => dispatch({ type: 'NAV', screen: 'journal' })} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
