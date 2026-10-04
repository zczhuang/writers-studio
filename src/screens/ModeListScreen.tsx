import { useEffect, type CSSProperties } from 'react';
import { ArrowRight, Check, Route, Sparkles } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { MODE_META, POOLS } from '../data/prompts';
import { MODE_THEME } from '../data/modeTheme';
import { dimensionsForChallenge } from '../data/promptSkills';
import { DIMENSIONS } from '../data/dimensionTheme';
import { toneVars } from '../data/tones';
import { modeProgress } from '../utils/progression';
import { WorldScene } from '../components/art/WorldScene';
import { ProgressRing } from '../components/art/ProgressRing';

export function ModeListScreen() {
  const { state, dispatch } = useApp();
  const mode = state.currentMode;

  useEffect(() => {
    if (!mode) dispatch({ type: 'NAV_RESET', screen: 'home' });
  }, [dispatch, mode]);

  if (!mode) return null;

  const meta = MODE_META[mode];
  const theme = MODE_THEME[mode];
  const completedIds = new Set(state.entries.filter((entry) => entry.mode === mode).map((entry) => entry.challengeId));
  const growthEdge = state.memory.growthEdge;
  const progress = modeProgress(state.entries, mode);
  const isGrowthPick = (challenge: (typeof POOLS)[typeof mode][number]) =>
    !!growthEdge && !completedIds.has(challenge.id) && dimensionsForChallenge(challenge).includes(growthEdge);
  const list = [...POOLS[mode]].sort((a, b) => {
    const aDone = completedIds.has(a.id);
    const bDone = completedIds.has(b.id);
    if (aDone !== bDone) return Number(aDone) - Number(bDone);
    return Number(isGrowthPick(b)) - Number(isGrowthPick(a));
  });

  return (
    <div className="ws-page" style={toneVars(mode)}>
      <section className="ws-chapter ws-rise" aria-labelledby="chapter-title">
        <div className="ws-chapter-copy">
          <span className="ws-chapter-kicker">
            <span className="ws-medallion ws-medallion--sm" aria-hidden="true"><theme.Icon size={16} /></span>
            World {theme.index} · {theme.world}
          </span>
          <h1 id="chapter-title" className="ws-chapter-title">{meta.label} <em>prompts</em></h1>
          <p className="ws-chapter-tagline">{meta.tagline} Follow the route, or choose the page that makes you curious.</p>
          <div className="ws-chapter-progress">
            <ProgressRing pct={progress.pct} size={60} stroke={6} label={`${meta.label} chapter progress, ${progress.pct} percent`}>
              <span className="text-[0.82rem] font-extrabold tabular-nums">{progress.pct}%</span>
            </ProgressRing>
            <div>
              <strong className="tabular">{progress.completed}/{progress.total}</strong>
              <span>challenges mapped in this world</span>
            </div>
          </div>
        </div>
        <div className="ws-chapter-art"><WorldScene mode={mode} /></div>
      </section>

      <section aria-labelledby="prompt-route-title" className="ws-rise" style={{ '--i': 1 } as CSSProperties}>
        <div className="ws-section-head">
          <div>
            <p className="ws-kicker"><Route size={14} aria-hidden="true" /> Choose your next page</p>
            <h2 id="prompt-route-title" className="ws-h2">The {meta.label.toLowerCase()} route</h2>
          </div>
          <span className="ws-small tabular">{list.length} stops</span>
        </div>
        <ol className="ws-route">
          {list.map((challenge, index) => {
            const done = completedIds.has(challenge.id);
            const growthPick = isGrowthPick(challenge);
            return (
              <li key={challenge.id}>
                <button
                  type="button"
                  className={`ws-prompt ${done ? 'is-done' : ''} ${growthPick ? 'is-growth' : ''}`}
                  data-prompt-row=""
                  data-done={done ? 'true' : 'false'}
                  onClick={() => {
                    dispatch({ type: 'PICK_CHALLENGE', challengeId: challenge.id });
                    dispatch({ type: 'NAV', screen: 'write' });
                  }}
                  aria-label={`${done ? 'Revisit' : 'Write'} ${challenge.title}`}
                >
                  <span className="ws-prompt-num" aria-hidden="true">{done ? <Check size={18} strokeWidth={2.6} /> : String(index + 1).padStart(2, '0')}</span>
                  <span className="ws-prompt-copy">
                    <span className="ws-prompt-title">{challenge.title}</span>
                    <span className="ws-prompt-text">{challenge.prompt}</span>
                    <span className="ws-prompt-meta">
                      <span className="ws-chip" style={toneVars('neutral')}>{done ? 'Mapped · revisit anytime' : `${challenge.targetWords[0]}–${challenge.targetWords[1]} words`}</span>
                      <span className="ws-chip">{challenge.skill}</span>
                      {growthPick && growthEdge && (
                        <span className="ws-chip" style={toneVars(growthEdge)}><Sparkles size={12} aria-hidden="true" /> Grows your {DIMENSIONS[growthEdge].kidLabel.toLowerCase()}</span>
                      )}
                    </span>
                  </span>
                  <span className="ws-prompt-go" aria-hidden="true"><ArrowRight size={18} /></span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
