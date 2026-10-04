import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, CheckCircle2, Coins, Cpu, Home, Lightbulb, PenLine, RefreshCw, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { TierReveal } from '../components/TierReveal';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { tierLabel } from '../services/scoring';
import { DIMENSIONS, DIMENSION_ORDER } from '../data/dimensionTheme';
import { tierVars, toneVars } from '../data/tones';
import { WritingShapeRadar } from '../components/visuals/WritingShapeRadar';
import { averageBreakdown, recommendSkill } from '../services/writerMemory';
import { SkillCard } from '../components/SkillCard';
import { DailyMissionList } from '../components/journey/DailyMissionList';
import { useLocalToday } from '../components/journey/useLocalToday';
import { TierMedal } from '../components/art/TierMedal';
import { StarField } from '../components/art/StarField';
import { Confetti } from '../components/art/Confetti';
import { dailyMissions, levelUpSnapshot, rankSnapshot, xpForEntry } from '../utils/progression';

const rise = (index: number) => ({ '--i': index } as CSSProperties);

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
  const forfeited = ledger?.status === 'forfeited' && ledger.tier !== 'none';
  const xpGain = xpForEntry(entry);
  const levelState = levelUpSnapshot(state.writer.xp, xpGain);
  const rank = rankSnapshot(state.writer.xp);
  const missions = dailyMissions(state.entries, today);
  const baselineEntries = state.entries.filter((candidate) => candidate.id !== entry.id);
  const baseline = averageBreakdown(baselineEntries) ?? undefined;
  const latestEntry = state.entries[state.entries.length - 1];
  const grew = latestEntry?.id === entry.id && state.memory.lastGrowth?.mode === entry.mode ? state.memory.lastGrowth : null;
  const recommended = recommendSkill(state.memory, state.craft.masteredSkills);
  const reviseTarget = DIMENSION_ORDER.reduce((lowest, dimension) => (judge.breakdown[dimension] < judge.breakdown[lowest] ? dimension : lowest), DIMENSION_ORDER[0]);
  const canRevise = (entry.revisionCount ?? 0) < 2 && judge.tier !== 'platinum';

  return (
    <>
      {!revealDone && <TierReveal tier={judge.tier} amount={actualAmount} forfeited={forfeited} revision={isRevision} xpGained={xpGain} onDone={handleRevealDone} />}

      {revealDone && (
        <div className="ws-page">
          <section className="ws-result-hero ws-night ws-rise" style={tierVars(judge.tier)} aria-labelledby="result-tier">
            <StarField seed={41} count={40} sparkles={4} />
            <div className="ws-result-medal ws-float"><TierMedal tier={judge.tier} /></div>
            <div className="ws-result-copy">
              <div className="ws-result-piece">Piece complete · {entry.challengeTitle}</div>
              <h1 id="result-tier" className="ws-result-tier">{tierLabel(judge.tier)}</h1>
              <div className="ws-result-pills">
                {isRevision ? (
                  <span className="ws-result-pill is-money" aria-label={`Best reward for this piece: ${actualAmount.toFixed(2)} dollars, ${rewardStatus}`}>
                    <Coins size={17} aria-hidden="true" /> ${actualAmount.toFixed(2)} <small>best reward · {rewardStatus}</small>
                  </span>
                ) : actualAmount > 0 ? (
                  <span className="ws-result-pill is-money"><Coins size={17} aria-hidden="true" /> +${actualAmount.toFixed(2)}</span>
                ) : null}
                <span className="ws-result-pill"><Sparkles size={16} aria-hidden="true" /> +{xpGain} XP earned</span>
                <span className="ws-result-pill"><Cpu size={15} aria-hidden="true" /> {judge.source === 'gemini' ? 'AI coach' : 'Local scoring'} <small>· {judge.score}/100</small></span>
              </div>
              {forfeited ? (
                <p className="ws-result-note">Daily cap reached, so this page counts for practice with no payment.</p>
              ) : actualAmount === 0 ? (
                <p className="ws-result-note">Practice only. No payment was recorded for this page.</p>
              ) : null}
            </div>
          </section>

          {levelState.leveledUp && (
            <section className="ws-levelup ws-rise" style={rise(1)} aria-live="polite">
              <Confetti />
              <span className="ws-medallion ws-medallion--lg ws-medallion--solid" style={toneVars('gold')} aria-hidden="true"><Trophy size={24} /></span>
              <div>
                <strong>You reached {levelState.currentLevel.name}!</strong>
                <p>{levelState.previousLevel.name} → {levelState.currentLevel.name}. The next part of the map is open.</p>
              </div>
            </section>
          )}

          {grew?.improved && (
            <section className="ws-callout ws-callout--ok ws-rise" style={rise(2)}>
              <TrendingUp size={19} aria-hidden="true" />
              <div>
                <strong className="font-display text-[1.1rem]">You grew.</strong>
                <p className="m-0 mt-0.5">Last time your coach nudged your {DIMENSIONS[grew.dimension].kidLabel.toLowerCase()}, and this {grew.mode} piece is stronger there.</p>
              </div>
            </section>
          )}

          {judge.celebrate && judge.tier !== 'none' && (
            <section className="ws-quote ws-rise" style={rise(3)}>
              <div className="ws-kicker">A line worth celebrating</div>
              <p>{judge.celebrate}.</p>
            </section>
          )}

          <div className="ws-grid-2 is-even ws-rise" style={rise(4)}>
            <section className="ws-card ws-card-pad" aria-labelledby="writing-shape-title">
              <div className="ws-section-head">
                <div>
                  <p className="ws-kicker">Coach feedback</p>
                  <h2 id="writing-shape-title" className="ws-h2">Your writing shape</h2>
                </div>
              </div>
              <div className="ws-radar-wrap"><WritingShapeRadar current={judge.breakdown} baseline={baseline} /></div>
              <div className="ws-legend" aria-hidden="true">
                <span><i style={{ background: '#F2C45A', border: '2px solid #C98A1C' }} /> This piece</span>
                {baseline && <span><i style={{ background: 'rgba(59, 66, 102, 0.12)', border: '2px dashed rgba(59, 66, 102, 0.55)' }} /> Your usual shape</span>}
              </div>
            </section>

            <section className="ws-card ws-card-pad" aria-labelledby="skill-scores-title">
              <div className="ws-section-head">
                <div>
                  <p className="ws-kicker">Five skills</p>
                  <h2 id="skill-scores-title" className="ws-h2">Skill scores</h2>
                </div>
                <span className="ws-chip tabular" style={tierVars(judge.tier)}>{judge.score}/100</span>
              </div>
              <div className="ws-dim-bars">
                {DIMENSION_ORDER.map((key) => {
                  const theme = DIMENSIONS[key];
                  const Glyph = theme.Glyph;
                  const value = Math.max(0, Math.min(10, judge.breakdown[key]));
                  return (
                    <div key={key} className="ws-dim-bar" style={toneVars(key)}>
                      <span className="ws-dim-bar-label"><Glyph size={15} aria-hidden="true" /><span>{theme.kidLabel}</span></span>
                      <div className="ws-progress" role="progressbar" aria-label={`${theme.label} score`} aria-valuemin={0} aria-valuemax={10} aria-valuenow={value}>
                        <span style={{ width: `${value * 10}%` }} />
                      </div>
                      <span className="ws-dim-bar-value">{value}</span>
                    </div>
                  );
                })}
              </div>
              <hr className="ws-divider" />
              <div className="ws-section-head" style={{ marginBottom: '0.6rem' }}>
                <div>
                  <p className="ws-kicker">Your route continues</p>
                  <h3 className="ws-h3">{rank.level.name} rank</h3>
                </div>
                <span className="ws-small tabular">{state.writer.xp.toLocaleString()} XP</span>
              </div>
              <ProgressBar pct={rank.pct} label={`${rank.level.name} rank progress`} />
              <div className="mt-2 flex justify-between text-[0.8rem] font-semibold text-text-muted">
                <span>{rank.nextLevel ? `${rank.xpToNext} XP to ${rank.nextLevel.name}` : 'Final rank · Author'}</span>
                <span className="tabular">{Math.round(rank.pct)}%</span>
              </div>
            </section>
          </div>

          {(judge.strengths.length > 0 || judge.suggestions.length > 0) && (
            <div className="ws-grid-2 is-even ws-rise" style={rise(5)}>
              {judge.strengths.length > 0 && (
                <section className="ws-card ws-card-pad" style={toneVars('success')} aria-labelledby="worked-title">
                  <div className="flex items-center gap-3">
                    <span className="ws-medallion ws-medallion--sm" aria-hidden="true"><CheckCircle2 size={17} /></span>
                    <h2 id="worked-title" className="ws-h3">What worked</h2>
                  </div>
                  <ul className="ws-feedback-list">
                    {judge.strengths.map((strength, index) => <li key={`${strength}-${index}`}><Sparkles size={15} aria-hidden="true" /><span>{strength}</span></li>)}
                  </ul>
                </section>
              )}
              {judge.suggestions.length > 0 && (
                <section className="ws-card ws-card-pad" style={toneVars('gold')} aria-labelledby="next-title">
                  <div className="flex items-center gap-3">
                    <span className="ws-medallion ws-medallion--sm" aria-hidden="true"><Lightbulb size={17} /></span>
                    <h2 id="next-title" className="ws-h3">Try next</h2>
                  </div>
                  <ul className="ws-feedback-list">
                    {judge.suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`}><PenLine size={15} aria-hidden="true" /><span>{suggestion}</span></li>)}
                  </ul>
                </section>
              )}
            </div>
          )}

          {canRevise && (
            <section className="ws-revision ws-rise" style={toneVars(reviseTarget, rise(6))}>
              <span className="ws-medallion ws-medallion--solid" aria-hidden="true"><RefreshCw size={20} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="ws-h3">Make it even better</h2>
                <p className="ws-small mt-1">
                  Revise this same piece with extra attention on your <strong className="text-ink">{DIMENSIONS[reviseTarget].kidLabel.toLowerCase()}</strong>. Your score may move either way; your best earned reward is kept, and the revision adds +8 effort XP.
                </p>
                <Button variant="gold" size="sm" className="mt-3" onClick={() => dispatch({ type: 'START_REVISION', entryId: entry.id })}>
                  <RefreshCw size={15} aria-hidden="true" /> Revise &amp; resubmit
                </Button>
              </div>
            </section>
          )}

          <div className="ws-rise" style={rise(7)}>
            <DailyMissionList missions={missions} />
          </div>

          {recommended && (
            <section aria-labelledby="trick-title" className="ws-rise" style={rise(8)}>
              <div className="ws-section-head">
                <div>
                  <p className="ws-kicker">From the craft library</p>
                  <h2 id="trick-title" className="ws-h2">A trick to try next</h2>
                </div>
              </div>
              <SkillCard card={recommended} compact onTryDrill={() => { dispatch({ type: 'MARK_SKILL_PRACTICED', id: recommended.id }); dispatch({ type: 'CLEAR_LAST_JUDGE' }); dispatch({ type: 'NAV_RESET', screen: 'craft-library' }); }} />
            </section>
          )}

          <div className="ws-write-actions">
            <Button variant="ghost" onClick={() => { dispatch({ type: 'CLEAR_LAST_JUDGE' }); dispatch({ type: 'NAV_RESET', screen: 'home' }); }}>
              <Home size={17} aria-hidden="true" /> Home
            </Button>
            <Button variant="gold" onClick={() => { dispatch({ type: 'CLEAR_LAST_JUDGE' }); dispatch({ type: 'NAV_RESET', screen: 'mode-list' }); }}>
              Write another <ArrowRight size={17} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
