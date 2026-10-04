import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { ArrowUpRight, BookOpen, Check, Eye, Pen, Sparkles, Wand } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { MODE_META, POOLS } from '../data/prompts';
import { dimensionsForChallenge } from '../data/promptSkills';
import { DIMENSIONS } from '../data/dimensionTheme';
import type { Mode } from '../types';
import { modeProgress } from '../utils/progression';
import { AtlasIllustration } from '../components/journey/AtlasIllustration';

const MODE_ICONS: Record<Mode, LucideIcon> = {
  scene: Eye,
  story: BookOpen,
  mystery: Wand,
  upgrade: Pen,
};

const MODE_COLORS: Record<Mode, string> = {
  scene: 'var(--atlas-teal)',
  story: 'var(--atlas-coral)',
  mystery: 'var(--atlas-lilac)',
  upgrade: 'var(--atlas-gold)',
};

export function ModeListScreen() {
  const { state, dispatch } = useApp();
  const mode = state.currentMode;

  useEffect(() => {
    if (!mode) dispatch({ type: 'NAV_RESET', screen: 'home' });
  }, [dispatch, mode]);

  if (!mode) return null;

  const meta = MODE_META[mode];
  const accent = MODE_COLORS[mode];
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
  const ModeIcon = MODE_ICONS[mode];

  return (
    <div className="atlas-page animate-slide-up">
      <section className="atlas-chapter-hero" style={{ '--mode-accent': accent } as CSSProperties}>
        <div>
          <div className="atlas-chapter-meta">
            <span className="atlas-chapter-icon"><ModeIcon size={21} aria-hidden="true" /></span>
            <span className="atlas-kicker">Chapter {mode === 'scene' ? '01' : mode === 'story' ? '02' : mode === 'mystery' ? '03' : '04'}</span>
          </div>
          <h1 className="atlas-chapter-title">{meta.label}<br /><span className="text-text-muted font-normal">prompts</span></h1>
          <p className="atlas-chapter-tagline">{meta.tagline} Follow the route, or choose the page that makes you curious.</p>
        </div>
        <div>
          <AtlasIllustration compact />
          <div className="atlas-chapter-progress">
            <strong>{progress.completed}/{progress.total}</strong>
            <span>challenges mapped · {progress.pct}% complete</span>
            <div className="atlas-world-track mt-3" role="progressbar" aria-label={`${meta.label} chapter progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct}>
              <span style={{ width: `${progress.pct}%`, background: accent }} />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="prompt-route-title">
        <div className="atlas-section-heading">
          <div>
            <p className="atlas-kicker">Choose your next page</p>
            <h2 id="prompt-route-title" className="atlas-heading atlas-heading-small">The {meta.label.toLowerCase()} route</h2>
          </div>
          <span className="atlas-caption">{list.length} stops</span>
        </div>
        <div className="atlas-prompt-list">
          {list.map((challenge, index) => {
            const done = completedIds.has(challenge.id);
            const growthPick = isGrowthPick(challenge);
            return (
              <button
                key={challenge.id}
                className={`atlas-prompt-row ${done ? 'is-done' : ''}`}
                style={{ '--mode-accent': accent } as CSSProperties}
                onClick={() => {
                  dispatch({ type: 'PICK_CHALLENGE', challengeId: challenge.id });
                  dispatch({ type: 'NAV', screen: 'write' });
                }}
                aria-label={`${done ? 'Revisit' : 'Write'} ${challenge.title}`}
              >
                <span className="atlas-prompt-number" aria-hidden="true">{done ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</span>
                <span className="atlas-prompt-copy">
                  <span className="atlas-prompt-title">{challenge.title}</span>
                  <span className="atlas-prompt-subtitle">{challenge.prompt}</span>
                  <span className="atlas-prompt-status">
                    <span>{done ? 'Mapped · revisit anytime' : `${challenge.targetWords[0]}–${challenge.targetWords[1]} words`}</span>
                    <span>·</span>
                    <span>{challenge.skill}</span>
                    {growthPick && growthEdge && (
                      <span className="atlas-prompt-growth"><Sparkles size={12} aria-hidden="true" /> Grows your {DIMENSIONS[growthEdge].kidLabel.toLowerCase()}</span>
                    )}
                  </span>
                </span>
                <ArrowUpRight className="atlas-prompt-arrow" size={19} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
