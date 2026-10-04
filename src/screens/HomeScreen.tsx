import type { CSSProperties } from 'react';
import { ArrowUpRight, BookOpen, Coins, Compass, Eye, Flame, Pen, PenLine, Sparkles, TrendingUp, Wand } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { MODE_META } from '../data/prompts';
import { Button } from '../components/ui/Button';
import { EntryCard } from '../components/EntryCard';
import { AtlasIllustration } from '../components/journey/AtlasIllustration';
import { AdventureTrail } from '../components/journey/AdventureTrail';
import { DailyMissionList } from '../components/journey/DailyMissionList';
import { WeeklyActivity } from '../components/journey/WeeklyActivity';
import { useLocalToday } from '../components/journey/useLocalToday';
import { DIMENSIONS } from '../data/dimensionTheme';
import { DimensionSparklines } from '../components/visuals/DimensionSparklines';
import { recommendSkill } from '../services/writerMemory';
import { useDailyCap } from '../hooks/useDailyCap';
import type { Mode } from '../types';
import { allModeProgress, dailyMissions, entriesOnDate, MODE_ORDER, rankSnapshot, recommendedChallenge, weeklyActivity } from '../utils/progression';
import { daysBetween } from '../utils/date';

const MODE_ICONS: Record<Mode, LucideIcon> = {
  scene: Eye,
  story: BookOpen,
  mystery: Wand,
  upgrade: Pen,
};

const MODE_TONES: Record<Mode, { accent: string; label: string }> = {
  scene: { accent: 'var(--atlas-teal)', label: 'A place to notice' },
  story: { accent: 'var(--atlas-coral)', label: 'A tale to continue' },
  mystery: { accent: 'var(--atlas-lilac)', label: 'A clue to follow' },
  upgrade: { accent: 'var(--atlas-gold)', label: 'A sentence to sharpen' },
};

export function HomeScreen() {
  const { state, dispatch } = useApp();
  const { writer, entries, memory } = state;
  const today = useLocalToday();
  const cap = useDailyCap();
  const rank = rankSnapshot(writer.xp);
  const missions = dailyMissions(entries, today);
  const activity = weeklyActivity(entries, today);
  const recommendation = recommendedChallenge(entries, memory);
  const craftFocus = recommendSkill(memory, state.craft.masteredSkills);
  const recent = [...entries].reverse().slice(0, 3);
  const worldProgress = allModeProgress(entries);
  const modesPlayedToday = new Set(entriesOnDate(entries, today).map((entry) => entry.mode));
  const nextExploreMode = MODE_ORDER.find((mode) => !modesPlayedToday.has(mode));
  const streakIsActive = writer.lastPlayDate !== null && daysBetween(writer.lastPlayDate, today) <= 1;

  const startAdventure = () => {
    dispatch({ type: 'PICK_MODE', mode: recommendation.mode });
    dispatch({ type: 'PICK_CHALLENGE', challengeId: recommendation.challenge.id });
    dispatch({ type: 'NAV', screen: 'write' });
  };

  const exploreChallenges = (mode = recommendation.mode) => {
    dispatch({ type: 'PICK_MODE', mode });
    dispatch({ type: 'NAV', screen: 'mode-list' });
  };

  const missionAction = (mission: (typeof missions)[number]) => {
    if (mission.action === 'modes') {
      if (nextExploreMode) exploreChallenges(nextExploreMode);
      else document.getElementById('worlds-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    startAdventure();
  };

  return (
    <div className="atlas-page animate-slide-up">
      <section className="atlas-hero">
        <div className="atlas-hero-copy">
          <p className="atlas-kicker">Writer&apos;s Studio · your next chapter</p>
          <h1 className="atlas-hero-title">Your story <em>atlas.</em></h1>
          <p className="atlas-hero-greeting">
            Welcome back, {writer.name}. Every page adds a new place to your map, and today&apos;s route is already waiting.
          </p>
          <div className="atlas-hero-actions">
            <Button variant="gold" size="lg" className="atlas-primary-action" onClick={startAdventure}>
              <Sparkles size={18} aria-hidden="true" />
              {recommendation.isReplay ? 'Revisit a favorite' : 'Start today’s adventure'}
            </Button>
            <button className="atlas-secondary-action" onClick={() => exploreChallenges()}>
              <Compass size={16} aria-hidden="true" /> Explore challenges <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="atlas-hero-note">
            {recommendation.isReplay ? `A replay route: ${recommendation.challenge.title}.` : `Recommended route: ${recommendation.challenge.title}.`}
          </p>
        </div>

        <div className="atlas-hero-art">
          <AtlasIllustration />
          <div className="atlas-rank-card">
            <div className="atlas-rank-line">
              <span className="atlas-rank-label">Current rank</span>
              <span className="atlas-rank-value">{writer.xp.toLocaleString()} XP</span>
            </div>
            <div className="atlas-rank-name">{rank.level.name}</div>
            <div className="mt-3">
              <div className="atlas-mini-track" role="progressbar" aria-label={`${rank.level.name} rank progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.pct)}>
                <span style={{ width: `${rank.pct}%` }} />
              </div>
              <div className="atlas-rank-meta">
                <span>{rank.nextLevel ? `${rank.xpToNext} XP to ${rank.nextLevel.name}` : 'Final rank · Author'}</span>
                <span>{Math.round(rank.pct)}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="atlas-stat-grid" aria-label="Writing stats">
        <div className="atlas-stat-capsule">
          <div className="atlas-stat-top"><Flame size={14} className="text-rust" aria-hidden="true" /> {streakIsActive ? 'Streak' : 'Latest streak'}</div>
          <div className="atlas-stat-value">{writer.streak} <span className="text-caption font-sans font-normal text-text-muted">{writer.streak === 1 ? 'day' : 'days'}</span></div>
          <div className="atlas-stat-note">Best: {writer.bestStreak} {writer.bestStreak === 1 ? 'day' : 'days'}</div>
        </div>
        <div className="atlas-stat-capsule">
          <div className="atlas-stat-top"><PenLine size={14} className="text-teal" aria-hidden="true" /> Words</div>
          <div className="atlas-stat-value">{writer.totalWords.toLocaleString()}</div>
          <div className="atlas-stat-note">In first drafts</div>
        </div>
        <div className="atlas-stat-capsule">
          <div className="atlas-stat-top"><Coins size={14} className="text-gold" aria-hidden="true" /> Pending</div>
          <div className="atlas-stat-value">${state.earnings.lifetimePending.toFixed(2)}</div>
          <div className="atlas-stat-note">{cap.capHit ? 'Today’s cap reached' : state.earnings.lifetimePending > 0 ? 'Waiting for a parent payout' : 'No payout waiting'}</div>
        </div>
      </div>

      <AdventureTrail xp={writer.xp} />

      <div className="atlas-two-column">
        <DailyMissionList missions={missions} onAction={missionAction} />
        <WeeklyActivity days={activity} />
      </div>

      <section aria-labelledby="worlds-title">
        <div className="atlas-section-heading">
          <div>
            <p className="atlas-kicker">Choose your landscape</p>
            <h2 id="worlds-title" className="atlas-heading">Explore four writing worlds</h2>
          </div>
          <button className="atlas-text-button" onClick={() => exploreChallenges()}>See a chapter <ArrowUpRight size={14} aria-hidden="true" /></button>
        </div>
        <div className="atlas-world-grid">
          {worldProgress.map((progress) => {
            const tone = MODE_TONES[progress.mode];
            const Icon = MODE_ICONS[progress.mode];
            const meta = MODE_META[progress.mode];
            return (
              <button
                key={progress.mode}
                className="atlas-world-card"
                style={{ '--mode-accent': tone.accent } as CSSProperties}
                onClick={() => {
                  dispatch({ type: 'PICK_MODE', mode: progress.mode });
                  dispatch({ type: 'NAV', screen: 'mode-list' });
                }}
              >
                <span className="atlas-world-top">
                  <span className="atlas-world-icon"><Icon size={19} aria-hidden="true" /></span>
                  <span className="atlas-world-index">0{MODE_ORDER_INDEX[progress.mode]}</span>
                </span>
                <span>
                  <span className="atlas-world-title">{meta.label}</span>
                  <span className="atlas-world-tagline">{tone.label}. {meta.tagline}</span>
                </span>
                <span className="atlas-world-footer">
                  <span className="atlas-world-progress-line"><span>{progress.completed}/{progress.total} challenges</span><span>{progress.pct}%</span></span>
                  <span className="atlas-world-track" role="progressbar" aria-label={`${meta.label} challenge progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct}><span style={{ width: `${progress.pct}%` }} /></span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="atlas-two-column">
        {craftFocus ? (
          <section className="atlas-panel" aria-labelledby="craft-focus-heading">
            <div className="atlas-section-heading">
              <div>
                <p className="atlas-kicker">A skill for this chapter</p>
                <h2 id="craft-focus-heading" className="atlas-heading atlas-heading-small">Recommended craft focus</h2>
              </div>
              <Sparkles size={18} className="text-gold" aria-hidden="true" />
            </div>
            <button className="atlas-focus-card w-full" onClick={() => dispatch({ type: 'NAV', screen: 'craft-library' })}>
              <span className="atlas-focus-icon" style={{ color: DIMENSIONS[craftFocus.dimension].color, ['--focus-accent' as string]: DIMENSIONS[craftFocus.dimension].color } as CSSProperties}>
                {(() => { const Glyph = DIMENSIONS[craftFocus.dimension].Glyph; return <Glyph size={22} aria-hidden="true" />; })()}
              </span>
              <span className="atlas-focus-copy" aria-label={`${craftFocus.title} by ${craftFocus.author}`}>
                <span className="atlas-kicker">{DIMENSIONS[craftFocus.dimension].kidLabel}</span>
                <span className="atlas-focus-title" id="craft-focus-card-title">{craftFocus.title}</span>
                <span className="atlas-focus-meta">{craftFocus.source === 'classic' ? 'A classic master' : 'A modern master'} · {craftFocus.author}</span>
              </span>
              <ArrowUpRight size={18} className="text-text-faint shrink-0" aria-hidden="true" />
            </button>
          </section>
        ) : (
          <section className="atlas-panel"><p className="atlas-kicker">Your desk</p><h2 className="atlas-heading atlas-heading-small">Your first craft focus will appear after a page.</h2></section>
        )}

        <section className="atlas-panel" aria-labelledby="recent-work-title">
          <div className="atlas-section-heading">
            <div>
              <p className="atlas-kicker">The pages behind you</p>
              <h2 id="recent-work-title" className="atlas-heading atlas-heading-small">Recent work</h2>
            </div>
            <button className="atlas-text-button" onClick={() => dispatch({ type: 'NAV', screen: 'journal' })}>Journal <ArrowUpRight size={14} aria-hidden="true" /></button>
          </div>
          {recent.length > 0 ? (
            <div className="space-y-3">{recent.map((entry) => <EntryCard key={entry.id} entry={entry} onClick={() => dispatch({ type: 'NAV', screen: 'journal' })} />)}</div>
          ) : (
            <p className="atlas-supportive-note"><PenLine size={14} aria-hidden="true" /> Your first page will live here.</p>
          )}
        </section>
      </div>

      {entries.length >= 3 && (
        <section className="atlas-panel" aria-labelledby="journey-shape-title">
          <div className="atlas-section-heading">
            <div>
              <p className="atlas-kicker">Patterns worth noticing</p>
              <h2 id="journey-shape-title" className="atlas-heading atlas-heading-small">Your writing journey</h2>
            </div>
            <TrendingUp size={18} className="text-teal" aria-hidden="true" />
          </div>
          <DimensionSparklines entries={entries} />
        </section>
      )}
    </div>
  );
}

const MODE_ORDER_INDEX: Record<Mode, number> = { scene: 1, story: 2, mystery: 3, upgrade: 4 };
