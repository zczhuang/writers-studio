import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Coins, ChevronRight, Lock, LogOut, BookMarked, TrendingUp } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useDailyCap } from '../hooks/useDailyCap';
import { Button } from '../components/ui/Button';
import { prettyDate } from '../utils/date';
import { tierLabel } from '../services/scoring';
import { DIMENSIONS } from '../data/dimensionTheme';
import { WritingShapeRadar } from '../components/visuals/WritingShapeRadar';
import { DimensionSparklines } from '../components/visuals/DimensionSparklines';
import { averageBreakdown } from '../services/writerMemory';
import { browserDeadlineRuntime, parentAccessIsActive, startDeadlineWatcher } from '../services/accessTiming';
import type { Screen } from '../types';

const TIER_TEXT: Record<string, string> = {
  none: 'text-text-faint',
  bronze: 'text-tier-bronze',
  silver: 'text-tier-silver',
  gold: 'text-tier-gold',
  platinum: 'text-tier-platinum',
};

export function ParentDashboardScreen() {
  const { state, dispatch } = useApp();
  const cap = useDailyCap();
  const [authNow, setAuthNow] = useState(() => Date.now());
  const isParent = state.parentUnlockedUntil > authNow;

  useEffect(
    () =>
      startDeadlineWatcher({
        deadlineMs: state.parentUnlockedUntil,
        onTime: setAuthNow,
        runtime: browserDeadlineRuntime(),
      }),
    [state.parentUnlockedUntil]
  );

  useEffect(() => {
    if (!isParent) dispatch({ type: 'REQUEST_PARENT_GATE', target: 'parent-dashboard' });
  }, [dispatch, isParent]);

  if (!isParent) return null;

  const enterParentScreen = (screen: Extract<Screen, 'settings' | 'wallet'>) => {
    if (!parentAccessIsActive(state.parentUnlockedUntil)) {
      dispatch({ type: 'REQUEST_PARENT_GATE', target: screen });
      return;
    }
    dispatch({ type: 'NAV', screen });
  };

  const recent = [...state.entries].reverse().slice(0, 5);

  const week = state.entries.filter((e) => authNow - e.createdAt < 7 * 86_400_000);
  const month = state.entries.filter((e) => authNow - e.createdAt < 30 * 86_400_000);
  const avg = (arr: typeof state.entries) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((s, e) => s + e.judge.score, 0) / arr.length);

  const { memory } = state;
  const hasGrowthView = state.entries.length >= 2;
  // "When they started" baseline: average of their earliest pieces.
  const startShape = state.entries.length >= 4 ? averageBreakdown(state.entries.slice(0, 5)) : undefined;

  return (
    <div className="space-y-5 animate-slide-up">
      <header>
        <div className="flex items-center gap-2 text-gold mb-1">
          <Lock size={14} />
          <span className="text-micro uppercase tracking-wider font-semibold">Parent mode</span>
        </div>
        <h1 className="font-display text-h1 font-semibold text-text">Parent dashboard</h1>
        <p className="text-text-muted text-caption mt-1">
          Parent access lasts 10 minutes.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-micro text-text-faint uppercase tracking-wider mb-1">Pending</div>
          <div className="font-mono text-h1 font-semibold text-gold tabular-nums">${state.earnings.lifetimePending.toFixed(2)}</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-micro text-text-faint uppercase tracking-wider mb-1">Paid</div>
          <div className="font-mono text-h1 font-semibold text-text tabular-nums">${state.earnings.lifetimePaid.toFixed(2)}</div>
        </div>
      </section>

      <section className="bg-surface border border-line rounded-xl p-4">
        <h2 className="font-display text-h3 font-semibold text-text mb-3">Activity</h2>
        <div className="grid grid-cols-3 gap-3 text-caption">
          <Stat label="Today" value={`$${cap.earnedToday.toFixed(2)}`} sub={`/ $${cap.cap.toFixed(2)}`} />
          <Stat label="This week" value={`${week.length}`} sub={`avg ${avg(week)}`} />
          <Stat label="This month" value={`${month.length}`} sub={`avg ${avg(month)}`} />
        </div>
      </section>

      {hasGrowthView && (
        <section className="bg-surface border border-line rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-teal" />
            <h2 className="font-display text-h3 font-semibold text-text">Skill growth</h2>
          </div>
          <p className="text-caption text-text-muted mb-3">
            {memory.strength && memory.growthEdge ? (
              <>
                Strongest at <span className="font-semibold" style={{ color: DIMENSIONS[memory.strength].color }}>{DIMENSIONS[memory.strength].label.toLowerCase()}</span>;
                working on <span className="font-semibold" style={{ color: DIMENSIONS[memory.growthEdge].color }}>{DIMENSIONS[memory.growthEdge].label.toLowerCase()}</span>.
              </>
            ) : (
              'A few more pieces will reveal strengths and growth areas.'
            )}
          </p>
          <WritingShapeRadar current={memory.mastery} baseline={startShape} size={230} />
          {startShape && (
            <p className="text-micro text-text-faint uppercase tracking-wide text-center -mt-1 mb-3">
              Now (gold) vs. when they started (grey)
            </p>
          )}
          <div className="pt-3 border-t border-line">
            <DimensionSparklines entries={state.entries} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-line">
            <Stat label="Words learned" value={`${memory.vocabularyVault.length}`} sub="in their vocab vault" />
            <Stat label="Craft skills" value={`${state.craft.masteredSkills.length}`} sub={`mastered · ${state.craft.practicedSkills.length} tried`} />
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-h3 font-semibold text-text">Recent entries</h2>
        {recent.length === 0 ? (
          <p className="text-caption text-text-muted py-4">No entries yet.</p>
        ) : (
          recent.map((e) => (
            <button
              key={e.id}
              onClick={() => dispatch({ type: 'NAV', screen: 'journal' })}
              className="w-full text-left bg-surface border border-line rounded-xl p-3 hover:border-gold/30 transition-colors"
            >
              <div className="flex justify-between text-caption text-text-muted">
                <span className="truncate">{e.challengeTitle}</span>
                <span className="shrink-0">{prettyDate(e.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-micro mt-1">
                <span className={`uppercase tracking-wider font-semibold ${TIER_TEXT[e.judge.tier]}`}>
                  {tierLabel(e.judge.tier)}
                </span>
                <span className="text-text-faint">·</span>
                <span className="text-text-faint tabular-nums">{e.judge.score}/100 · {e.wordCount} words</span>
              </div>
            </button>
          ))
        )}
      </section>

      <section className="space-y-2">
        <ActionRow
          icon={<Coins size={18} />}
          label="Pay out pending earnings"
          onClick={() => enterParentScreen('wallet')}
          disabled={state.earnings.lifetimePending === 0}
        />
        <ActionRow
          icon={<BookMarked size={18} />}
          label="Read all entries"
          onClick={() => dispatch({ type: 'NAV', screen: 'journal' })}
        />
        <ActionRow
          icon={<SettingsIcon size={18} />}
          label="Settings"
          onClick={() => enterParentScreen('settings')}
        />
      </section>

      <Button
        variant="ghost"
        fullWidth
        onClick={() => {
          dispatch({ type: 'LOCK_PARENT' });
          dispatch({ type: 'NAV_RESET', screen: 'home' });
        }}
      >
        <LogOut size={16} /> Lock parent mode
      </Button>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-micro text-text-faint uppercase tracking-wider">{label}</div>
      <div className="font-mono text-h3 font-semibold text-text tabular-nums">{value}</div>
      {sub && <div className="text-micro text-text-faint tabular-nums">{sub}</div>}
    </div>
  );
}

function ActionRow({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-surface border border-line rounded-xl p-4 flex items-center gap-3 hover:border-gold/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
      <span className="bg-gold/15 text-gold rounded-lg p-2">{icon}</span>
      <span className="flex-1 font-medium text-text">{label}</span>
      <ChevronRight size={16} className="text-text-faint" />
    </button>
  );
}
