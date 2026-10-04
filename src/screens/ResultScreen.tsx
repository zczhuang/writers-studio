import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, Coins, Cpu, Home, PenLine, Quote, RefreshCw, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { TierReveal } from '../components/TierReveal';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { tierLabel } from '../services/scoring';
import { DIMENSIONS, DIMENSION_ORDER } from '../data/dimensionTheme';
import { WritingShapeRadar } from '../components/visuals/WritingShapeRadar';
import { averageBreakdown, recommendSkill } from '../services/writerMemory';
import { SkillCard } from '../components/SkillCard';
import { DailyMissionList } from '../components/journey/DailyMissionList';
import { useLocalToday } from '../components/journey/useLocalToday';
import { dailyMissions, levelUpSnapshot, rankSnapshot, xpForEntry } from '../utils/progression';
import type { Tier } from '../types';

const TIER_ACCENT: Record<Tier, string> = {
  none: 'var(--text-faint)',
  bronze: 'var(--tier-bronze)',
  silver: 'var(--tier-silver)',
  gold: 'var(--tier-gold)',
  platinum: 'var(--tier-platinum)',
};

export function ResultScreen() {
  const { state, dispatch } = useApp();
  const entry = (state.lastEntryId ? state.entries.find((candidate) => candidate.id === state.lastEntryId) : undefined) ?? state.entries[state.entries.length - 1];
  const judge = state.lastJudge ?? entry?.judge;
  const [revealDone, setRevealDone] = useState(false);
  const today = useLocalToday();
  const handleRevealDone = useCallback(() => setRevealDone(true), []);

  useEffect(() => {
    if (!entry) dispatch({ type: 'NAV_RESET', screen: 'home' });
  }, [entry, dispatch]);

  if (!entry || !judge) return null;

  const ledger = state.earnings.ledger.find((row) => row.id === entry.earningsId);
  const actualAmount = ledger && Number.isFinite(ledger.amount) ? Math.max(0, ledger.amount) : 0;
  const isRevision = (entry.revisionCount ?? 0) > 0;
  const rewardStatus = ledger?.status === 'paid' ? 'paid' : ledger?.status === 'pending' ? 'pending' : 'practice';
  const rewardStatusLabel = rewardStatus[0].toUpperCase() + rewardStatus.slice(1);
  const forfeited = ledger?.status === 'forfeited' && ledger.tier !== 'none';
  const xpGain = xpForEntry(entry);
  const levelState = levelUpSnapshot(state.writer.xp, xpGain);
  const rank = rankSnapshot(state.writer.xp);
  const missions = dailyMissions(state.entries, today);
  const baselineEntries = state.entries.filter((candidate) => candidate.id !== entry.id);
  const baseline = baselineEntries.length > 0 ? averageBreakdown(baselineEntries) : undefined;
  const latestEntry = state.entries[state.entries.length - 1];
  const grew = latestEntry?.id === entry.id && state.memory.lastGrowth?.mode === entry.mode ? state.memory.lastGrowth : null;
  const recommended = recommendSkill(state.memory, state.craft.masteredSkills);
  const reviseTarget = DIMENSION_ORDER.reduce((lowest, dimension) => (judge.breakdown[dimension] < judge.breakdown[lowest] ? dimension : lowest), DIMENSION_ORDER[0]);
  const canRevise = (entry.revisionCount ?? 0) < 2 && judge.tier !== 'platinum';

  return (
    <>
      {!revealDone && <TierReveal tier={judge.tier} amount={actualAmount} forfeited={forfeited} revision={isRevision} xpGained={xpGain} onDone={handleRevealDone} />}

      {revealDone && (
        <div className="atlas-page animate-slide-up">
          <section className="atlas-result-hero" style={{ '--result-accent': TIER_ACCENT[judge.tier] } as CSSProperties}>
            <div className="atlas-result-kicker">Piece complete · {entry.challengeTitle}</div>
            <h1 className="atlas-result-tier">{tierLabel(judge.tier)}</h1>
            {isRevision ? (
              <div className="atlas-result-reward" aria-label={`Best reward for this piece: ${actualAmount.toFixed(2)} dollars, ${rewardStatus}`}>
                <span className="atlas-result-reward-label">Best reward for this piece</span>
                <span className="atlas-result-reward-value"><Coins size={17} className="text-gold" aria-hidden="true" /> ${actualAmount.toFixed(2)}</span>
                <span className="atlas-result-reward-status">{rewardStatusLabel}</span>
              </div>
            ) : actualAmount > 0 ? (
              <div className="atlas-result-amount"><Coins size={18} className="text-gold inline-block mr-1" aria-hidden="true" /> +${actualAmount.toFixed(2)}</div>
            ) : null}
            {forfeited ? <p className="text-caption text-text-muted mt-2">Daily cap reached — this page counts for practice, no payment.</p> : actualAmount === 0 ? <p className="text-caption text-text-muted mt-2">Practice only — no payment was recorded for this page.</p> : null}
            <span className="atlas-result-xp"><Sparkles size={15} aria-hidden="true" /> +{xpGain} XP earned</span>
            <div className="mt-3 inline-flex items-center gap-1.5 text-micro uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface border border-line text-text-muted">
              <Cpu size={11} aria-hidden="true" />
              <span>{judge.source === 'gemini' ? 'AI coach' : 'Local scoring'}</span>
              <span className="text-text-faint">·</span>
              <span className="tabular-nums">{judge.score}/100</span>
            </div>
          </section>

          {levelState.leveledUp && (
            <section className="atlas-level-up" aria-live="polite">
              <span className="atlas-level-up-mark" aria-hidden="true"><Trophy size={19} /></span>
              <div><strong>You reached {levelState.currentLevel.name}.</strong><p>{levelState.previousLevel.name} → {levelState.currentLevel.name} · the next part of the map is open.</p></div>
            </section>
          )}

          <section className="atlas-panel" aria-labelledby="rank-progress-title">
            <div className="atlas-section-heading">
              <div><p className="atlas-kicker">Your route continues</p><h2 id="rank-progress-title" className="atlas-heading atlas-heading-small">{rank.level.name} rank progress</h2></div>
              <span className="atlas-rank-value">{state.writer.xp.toLocaleString()} XP</span>
            </div>
            <ProgressBar pct={rank.pct} label={`${rank.level.name} rank progress`} />
            <div className="atlas-rank-meta"><span>{rank.nextLevel ? `${rank.xpToNext} XP to ${rank.nextLevel.name}` : 'Final rank · Author'}</span><span>{Math.round(rank.pct)}%</span></div>
          </section>

          {grew?.improved && (
            <section className="atlas-level-up">
              <TrendingUp size={19} className="text-moss shrink-0" aria-hidden="true" />
              <div><strong className="text-moss">You grew.</strong><p>Last time your coach nudged your {DIMENSIONS[grew.dimension].kidLabel.toLowerCase()}, and this {grew.mode} piece is stronger there.</p></div>
            </section>
          )}

          <DailyMissionList missions={missions} />

          <section className="atlas-panel" aria-labelledby="writing-shape-title">
            <div className="atlas-section-heading">
              <div><p className="atlas-kicker">Coach feedback</p><h2 id="writing-shape-title" className="atlas-heading atlas-heading-small">Your writing shape</h2><p className="atlas-caption">{baseline ? 'This piece in gold · your usual shape in grey' : 'This piece across five skills'}</p></div>
            </div>
            <WritingShapeRadar current={judge.breakdown} baseline={baseline} />
            <div className="space-y-2.5 mt-4 pt-4 border-t border-line">
              {DIMENSION_ORDER.map((key) => {
                const theme = DIMENSIONS[key];
                const Glyph = theme.Glyph;
                const value = Math.max(0, Math.min(10, judge.breakdown[key]));
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 w-28 shrink-0"><Glyph size={13} style={{ color: theme.color }} aria-hidden="true" /><span className="text-caption text-text-muted truncate">{theme.label}</span></span>
                    <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden" role="progressbar" aria-label={`${theme.label} score`} aria-valuemin={0} aria-valuemax={10} aria-valuenow={value}><div className="h-full rounded-full" style={{ width: `${value * 10}%`, backgroundColor: theme.color }} /></div>
                    <span className="font-mono text-caption font-semibold text-text tabular-nums w-8 text-right">{value}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {judge.celebrate && judge.tier !== 'none' && (
            <section className="atlas-panel atlas-celebrate-panel">
              <div className="flex items-start gap-2.5"><Quote size={18} className="text-gold shrink-0 mt-0.5" aria-hidden="true" /><div><div className="atlas-kicker">Line worth celebrating</div><p className="font-serif italic text-text leading-snug">&ldquo;{judge.celebrate}.&rdquo;</p></div></div>
            </section>
          )}

          <div className="atlas-two-column">
            {judge.strengths.length > 0 && (
              <section className="atlas-panel" aria-labelledby="worked-title"><div className="flex items-center gap-2 mb-2"><Sparkles size={16} className="text-moss" aria-hidden="true" /><h2 id="worked-title" className="atlas-heading atlas-heading-small">What worked</h2></div><ul className="space-y-2 text-caption text-text-muted font-serif">{judge.strengths.map((strength, index) => <li key={`${strength}-${index}`} className="flex gap-2"><span className="text-moss shrink-0">·</span><span>{strength}</span></li>)}</ul></section>
            )}
            {judge.suggestions.length > 0 && (
              <section className="atlas-panel" aria-labelledby="next-title"><div className="flex items-center gap-2 mb-2"><PenLine size={16} className="text-gold" aria-hidden="true" /><h2 id="next-title" className="atlas-heading atlas-heading-small">Try next</h2></div><ul className="space-y-2 text-caption text-text-muted font-serif">{judge.suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`} className="flex gap-2"><span className="text-gold shrink-0">·</span><span>{suggestion}</span></li>)}</ul></section>
            )}
          </div>

          {canRevise && (
            <section className="atlas-panel atlas-revision-panel">
              <div className="flex items-start gap-3"><span className="shrink-0 rounded-lg p-2 bg-gold/15 text-gold"><RefreshCw size={20} aria-hidden="true" /></span><div className="flex-1 min-w-0"><h2 className="atlas-heading atlas-heading-small">Make it even better</h2><p className="text-caption text-text-muted mt-1 leading-snug">Revise this same piece with extra attention on your <span className="text-text font-semibold">{DIMENSIONS[reviseTarget].kidLabel.toLowerCase()}</span>. Your score may move either way; your best earned reward is retained, and the revision adds +8 effort XP.</p><Button variant="gold" size="sm" className="mt-3" onClick={() => dispatch({ type: 'START_REVISION', entryId: entry.id })}><RefreshCw size={15} aria-hidden="true" /> Revise &amp; resubmit</Button></div></div>
            </section>
          )}

          {recommended && (
            <section aria-labelledby="trick-title"><div className="flex items-center gap-2 mb-2"><Sparkles size={16} className="text-gold" aria-hidden="true" /><h2 id="trick-title" className="atlas-heading atlas-heading-small">A trick to try next</h2></div><SkillCard card={recommended} compact onTryDrill={() => { dispatch({ type: 'MARK_SKILL_PRACTICED', id: recommended.id }); dispatch({ type: 'CLEAR_LAST_JUDGE' }); dispatch({ type: 'NAV_RESET', screen: 'craft-library' }); }} /></section>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => { dispatch({ type: 'CLEAR_LAST_JUDGE' }); dispatch({ type: 'NAV_RESET', screen: 'home' }); }} className="flex-1"><Home size={16} aria-hidden="true" /> Home</Button>
            <Button variant="gold" onClick={() => { dispatch({ type: 'CLEAR_LAST_JUDGE' }); dispatch({ type: 'NAV_RESET', screen: 'mode-list' }); }} className="flex-[2]">Write another <ArrowRight size={16} aria-hidden="true" /></Button>
          </div>
        </div>
      )}
    </>
  );
}
