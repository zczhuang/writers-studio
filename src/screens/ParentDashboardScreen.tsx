import { useEffect, useState, type CSSProperties } from 'react';
import { BookMarked, ChevronRight, Cloud, Coins, LogOut, Settings as SettingsIcon, ShieldCheck, TrendingUp } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useDailyCap } from '../hooks/useDailyCap';
import { Button } from '../components/ui/Button';
import { prettyDate } from '../utils/date';
import { DIMENSIONS } from '../data/dimensionTheme';
import { toneVars } from '../data/tones';
import { WritingShapeRadar } from '../components/visuals/WritingShapeRadar';
import { DimensionSparklines } from '../components/visuals/DimensionSparklines';
import { averageBreakdown, entriesWithLatestValidGrading } from '../services/writerMemory';
import { browserDeadlineRuntime, parentAccessIsActive, startDeadlineWatcher } from '../services/accessTiming';
import type { Screen } from '../types';
import { gradingPresentation } from '../services/gradingPresentation';
import { TierChip } from '../components/TierChip';
import { StarField } from '../components/art/StarField';
import { CloudStatusPanel } from '../components/CloudStatusPanel';

const rise = (index: number) => ({ '--i': index } as CSSProperties);

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
  const avg = (arr: typeof state.entries) => {
    const graded = entriesWithLatestValidGrading(arr);
    return graded.length === 0 ? null : Math.round(graded.reduce((sum, entry) => sum + entry.judge.score, 0) / graded.length);
  };

  const { memory } = state;
  const gradedEntries = entriesWithLatestValidGrading(state.entries);
  const hasGrowthView = gradedEntries.length >= 2;
  // "When they started" baseline: average of their earliest pieces.
  const startShape = gradedEntries.length >= 4 ? averageBreakdown(gradedEntries.slice(0, 5)) ?? undefined : undefined;

  return (
    <div className="ws-page">
      <section className="ws-parent-head ws-night ws-rise" aria-labelledby="parent-title">
        <StarField seed={13} count={30} sparkles={3} />
        <div>
          <span className="ws-parent-badge"><ShieldCheck size={14} aria-hidden="true" /> Parent mode</span>
          <h1 id="parent-title" className="ws-h1 mt-3">Parent dashboard</h1>
          <p className="ws-lede">How {state.writer.name} is writing, what&apos;s waiting to be paid, and whether progress is backed up.</p>
        </div>
        <span className="ws-small text-right">Parent access lasts 10 minutes</span>
      </section>

      <div className="ws-kpis ws-rise" style={rise(1)}>
        <Kpi tone="gold" label="Waiting payout" value={`$${state.earnings.lifetimePending.toFixed(2)}`} sub={`$${state.earnings.lifetimePaid.toFixed(2)} paid so far`} />
        <Kpi tone="story" label="Earned today" value={`$${cap.earnedToday.toFixed(2)}`} sub={`of a $${cap.cap.toFixed(2)} daily cap`} />
        <Kpi tone="scene" label="This week" value={`${week.length}`} sub={`pieces · avg score ${avg(week) ?? '—'}`} />
        <Kpi tone="mystery" label="This month" value={`${month.length}`} sub={`pieces · avg score ${avg(month) ?? '—'}`} />
      </div>

      <section className="ws-card ws-card-pad ws-rise" style={rise(2)} aria-labelledby="backup-title">
        <div className="ws-section-head">
          <div>
            <p className="ws-kicker"><Cloud size={14} aria-hidden="true" /> Progress safety</p>
            <h2 id="backup-title" className="ws-h2">Saved progress</h2>
          </div>
          <button type="button" className="ws-link-btn" onClick={() => enterParentScreen('settings')}>
            Backup settings <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
        <CloudStatusPanel />
      </section>

      {hasGrowthView && (
        <section className="ws-card ws-card-pad ws-rise" style={rise(3)} aria-labelledby="growth-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker"><TrendingUp size={14} aria-hidden="true" /> Skill growth</p>
              <h2 id="growth-title" className="ws-h2">How the writing is changing</h2>
            </div>
          </div>
          <p className="ws-body mt-0">
            {memory.strength && memory.growthEdge ? (
              <>
                Strongest at <strong style={{ color: DIMENSIONS[memory.strength].ink }}>{DIMENSIONS[memory.strength].label.toLowerCase()}</strong>;
                working on <strong style={{ color: DIMENSIONS[memory.growthEdge].ink }}>{DIMENSIONS[memory.growthEdge].label.toLowerCase()}</strong>.
              </>
            ) : (
              'A few more pieces will reveal strengths and growth areas.'
            )}
          </p>
          <div className="ws-grid-2 is-even">
            <div>
              <div className="ws-radar-wrap"><WritingShapeRadar current={memory.mastery} baseline={startShape} size={340} /></div>
              {startShape && (
                <div className="ws-legend" aria-hidden="true">
                  <span><i style={{ background: '#F2C45A', border: '2px solid #C98A1C' }} /> Now</span>
                  <span><i style={{ background: 'rgba(59, 66, 102, 0.12)', border: '2px dashed rgba(59, 66, 102, 0.55)' }} /> When they started</span>
                </div>
              )}
            </div>
            <div className="grid content-start gap-4">
              <DimensionSparklines entries={state.entries} compact />
              <div className="grid grid-cols-2 gap-3">
                <Kpi tone="vocabulary" label="Words learned" value={`${memory.vocabularyVault.length}`} sub="in the vocab vault" flat />
                <Kpi tone="success" label="Craft skills" value={`${state.craft.masteredSkills.length}`} sub={`mastered · ${state.craft.practicedSkills.length} tried`} flat />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="ws-grid-2 ws-rise" style={rise(4)}>
        <section className="ws-card ws-card-pad" aria-labelledby="recent-entries-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker"><BookMarked size={14} aria-hidden="true" /> Latest pages</p>
              <h2 id="recent-entries-title" className="ws-h2">Recent entries</h2>
            </div>
          </div>
          {recent.length === 0 ? (
            <p className="ws-body">No entries yet.</p>
          ) : (
            <div className="ws-action-list">
              {recent.map((e) => {
                const grade = gradingPresentation(e);
                return (
                  <button key={e.id} type="button" onClick={() => dispatch({ type: 'NAV', screen: 'journal' })} className="ws-action" style={{ minHeight: '3.5rem' }}>
                    <span className="ws-action-label">
                      {e.challengeTitle}
                      <small>{prettyDate(e.createdAt)} · {grade.available ? `${grade.scoreText} · ` : ''}{e.wordCount} words</small>
                    </span>
                    <TierChip tier={grade.available ? e.judge.tier : 'none'} label={grade.tierText} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="ws-card ws-card-pad" aria-labelledby="parent-actions-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker">Grown-up tools</p>
              <h2 id="parent-actions-title" className="ws-h2">Actions</h2>
            </div>
          </div>
          <div className="ws-action-list">
            <ActionRow tone="gold" icon={<Coins size={18} />} label="Pay out pending earnings" sub={`$${state.earnings.lifetimePending.toFixed(2)} waiting`} onClick={() => enterParentScreen('wallet')} disabled={state.earnings.lifetimePending === 0} />
            <ActionRow tone="scene" icon={<BookMarked size={18} />} label="Read all entries" sub={`${state.entries.length} pieces in the journal`} onClick={() => dispatch({ type: 'NAV', screen: 'journal' })} />
            <ActionRow tone="night" icon={<SettingsIcon size={18} />} label="Settings & backup" sub="Coach, daily cap, PIN, cloud recovery" onClick={() => enterParentScreen('settings')} />
          </div>
          <Button
            variant="ghost"
            fullWidth
            className="mt-4"
            onClick={() => {
              dispatch({ type: 'LOCK_PARENT' });
              dispatch({ type: 'NAV_RESET', screen: 'home' });
            }}
          >
            <LogOut size={16} aria-hidden="true" /> Lock parent mode
          </Button>
        </section>
      </div>
    </div>
  );
}

function Kpi({ tone, label, value, sub, flat }: { tone: Parameters<typeof toneVars>[0]; label: string; value: string; sub?: string; flat?: boolean }) {
  return (
    <div className={`ws-card ws-kpi ${flat ? 'ws-card--flat' : ''}`} style={toneVars(tone)}>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--tone)' }} aria-hidden="true" />
        <span className="ws-kpi-label">{label}</span>
      </div>
      <div className="ws-kpi-value">{value}</div>
      {sub && <div className="ws-kpi-sub">{sub}</div>}
    </div>
  );
}

function ActionRow({ tone, icon, label, sub, onClick, disabled }: { tone: Parameters<typeof toneVars>[0]; icon: React.ReactNode; label: string; sub?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="ws-action" style={toneVars(tone)}>
      <span className="ws-medallion ws-medallion--sm" aria-hidden="true">{icon}</span>
      <span className="ws-action-label">{label}{sub && <small>{sub}</small>}</span>
      <ChevronRight size={17} className="text-text-muted" aria-hidden="true" />
    </button>
  );
}
