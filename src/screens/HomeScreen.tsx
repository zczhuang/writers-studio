import type { CSSProperties } from 'react';
import { ArrowUpRight, BookMarked, Coins, Compass, Flame, Globe2, Library, PenLine, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { MODE_META } from '../data/prompts';
import { MODE_THEME } from '../data/modeTheme';
import { toneVars } from '../data/tones';
import { EntryCard } from '../components/EntryCard';
import { HeroScene } from '../components/art/HeroScene';
import { StarField } from '../components/art/StarField';
import { WorldScene } from '../components/art/WorldScene';
import { ProgressRing } from '../components/art/ProgressRing';
import { AdventureTrail } from '../components/journey/AdventureTrail';
import { DailyMissionList } from '../components/journey/DailyMissionList';
import { WeeklyActivity } from '../components/journey/WeeklyActivity';
import { useLocalToday } from '../components/journey/useLocalToday';
import { useGreeting } from '../components/journey/useGreeting';
import { LEVEL_ICONS } from '../components/journey/levelIcons';
import { DIMENSIONS } from '../data/dimensionTheme';
import { DimensionSparklines } from '../components/visuals/DimensionSparklines';
import { recommendSkill } from '../services/writerMemory';
import { useDailyCap } from '../hooks/useDailyCap';
import { allModeProgress, dailyMissions, entriesOnDate, MODE_ORDER, rankSnapshot, recommendedChallenge, weeklyActivity } from '../utils/progression';
import { daysBetween } from '../utils/date';

const rise = (index: number) => ({ '--i': index } as CSSProperties);

export function HomeScreen() {
  const { state, dispatch } = useApp();
  const { writer, entries, memory } = state;
  const today = useLocalToday();
  const greeting = useGreeting();
  const cap = useDailyCap();
  const rank = rankSnapshot(writer.xp);
  const RankIcon = LEVEL_ICONS[rank.level.icon] ?? PenLine;
  const missions = dailyMissions(entries, today);
  const activity = weeklyActivity(entries, today);
  const recommendation = recommendedChallenge(entries, memory);
  const recommendedTheme = MODE_THEME[recommendation.mode];
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

  const openParentArea = () => {
    if (state.parentUnlockedUntil > Date.now()) dispatch({ type: 'NAV', screen: 'parent-dashboard' });
    else dispatch({ type: 'REQUEST_PARENT_GATE', target: 'parent-dashboard' });
  };

  return (
    <div className="ws-page">
      <section className="ws-hero ws-night ws-rise" style={rise(0)} aria-labelledby="home-hero-title">
        <StarField seed={5} count={52} sparkles={5} />
        <div className="ws-hero-copy">
          <p className="ws-hero-greeting"><Sparkles size={15} aria-hidden="true" /> {greeting}, {writer.name}</p>
          <h1 id="home-hero-title" className="ws-hero-title">Your story <em>atlas</em></h1>
          <p className="ws-hero-sub">
            Every page you write adds a new place to your map. {recommendation.isReplay ? 'Revisit a favorite route today, or pick a new world.' : 'Today’s route is already waiting.'}
          </p>
          <div className="ws-hero-route" style={toneVars(recommendation.mode)}>
            <span className="ws-medallion" aria-hidden="true"><recommendedTheme.Icon size={20} /></span>
            <span className="min-w-0">
              <span className="ws-hero-route-label">{recommendation.isReplay ? 'A replay route' : 'Recommended route'}</span>
              <span className="ws-hero-route-title">{recommendation.challenge.title}</span>
              <span className="ws-hero-route-meta">
                {MODE_META[recommendation.mode].label} · {recommendation.challenge.targetWords[0]}–{recommendation.challenge.targetWords[1]} words
                {recommendation.growthDimension ? ` · builds ${DIMENSIONS[recommendation.growthDimension].kidLabel.toLowerCase()}` : ''}
              </span>
            </span>
          </div>
          <div className="ws-hero-actions">
            <button type="button" className="ws-btn ws-btn--gold ws-btn--lg" onClick={startAdventure}>
              <PenLine size={19} aria-hidden="true" />
              {recommendation.isReplay ? 'Revisit a favorite' : 'Start today’s adventure'}
            </button>
            <button type="button" className="ws-btn ws-btn--ghost-light ws-btn--lg" onClick={() => exploreChallenges()}>
              <Compass size={18} aria-hidden="true" /> Explore challenges
            </button>
          </div>
        </div>

        <div className="ws-hero-art">
          <HeroScene />
          <div className="ws-hero-rank" style={toneVars('gold')}>
            <ProgressRing pct={rank.pct} size={58} stroke={6} label={`${rank.level.name} rank progress, ${Math.round(rank.pct)} percent`}>
              <RankIcon size={22} className="text-gold-deep" aria-hidden="true" />
            </ProgressRing>
            <div className="ws-hero-rank-copy">
              <span className="ws-hero-rank-label">Current rank</span>
              <span className="ws-hero-rank-name">{rank.level.name}</span>
              <span className="ws-hero-rank-meta">
                <span>{rank.nextLevel ? `${rank.xpToNext} XP to ${rank.nextLevel.name}` : 'Final rank · Author'}</span>
                <span className="tabular">{writer.xp.toLocaleString()} XP</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="ws-stats" aria-label="Writing stats">
        <StatTile index={1} tone="voice" Icon={Flame} label={streakIsActive ? 'Day streak' : 'Last streak'} value={writer.streak} unit={writer.streak === 1 ? 'day' : 'days'} note={`Best: ${writer.bestStreak} ${writer.bestStreak === 1 ? 'day' : 'days'}`} />
        <StatTile index={2} tone="scene" Icon={PenLine} label="Words written" value={writer.totalWords.toLocaleString()} note="Counted from first drafts" />
        <StatTile index={3} tone="mystery" Icon={BookMarked} label="Pieces" value={entries.length} note={`${worldProgress.filter((world) => world.completed > 0).length} of 4 worlds visited`} />
        <StatTile index={4} tone="gold" Icon={Coins} label="Waiting payout" value={`$${state.earnings.lifetimePending.toFixed(2)}`} note={cap.capHit ? 'Today’s cap reached' : state.earnings.lifetimePending > 0 ? 'Ready for a parent payout' : 'Nothing waiting yet'} />
      </div>

      <div className="ws-rise" style={rise(5)}>
        <AdventureTrail xp={writer.xp} />
      </div>

      <div className="ws-grid-2 ws-rise" style={rise(6)}>
        <DailyMissionList missions={missions} onAction={missionAction} />
        <WeeklyActivity days={activity} />
      </div>

      <section aria-labelledby="worlds-title" className="ws-rise" style={rise(7)}>
        <div className="ws-section-head">
          <div>
            <p className="ws-kicker"><Globe2 size={14} aria-hidden="true" /> Choose your landscape</p>
            <h2 id="worlds-title" className="ws-h2">Four writing worlds</h2>
          </div>
          <button type="button" className="ws-link-btn" onClick={() => exploreChallenges()}>
            See all <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="ws-worlds">
          {worldProgress.map((progress) => {
            const theme = MODE_THEME[progress.mode];
            const meta = MODE_META[progress.mode];
            return (
              <button
                key={progress.mode}
                type="button"
                className="ws-world"
                style={toneVars(progress.mode)}
                onClick={() => exploreChallenges(progress.mode)}
                aria-label={`${meta.label}: ${theme.invitation}. ${progress.completed} of ${progress.total} challenges complete.`}
              >
                <span className="ws-world-art">
                  <WorldScene mode={progress.mode} />
                  <span className="ws-world-badge"><theme.Icon size={13} aria-hidden="true" /> World {theme.index}</span>
                </span>
                <span className="ws-world-body">
                  <span className="ws-world-title">{meta.label}</span>
                  <span className="ws-world-tagline">{theme.invitation}. {meta.tagline}</span>
                  <span className="ws-world-progress"><span>{progress.completed}/{progress.total} challenges</span><span>{progress.pct}%</span></span>
                  <span className="ws-progress ws-progress--thin" aria-hidden="true"><span style={{ width: `${progress.pct}%` }} /></span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="ws-grid-2 ws-rise" style={rise(8)}>
        <section className="ws-card ws-card-pad" aria-labelledby="craft-focus-heading">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker"><Library size={14} aria-hidden="true" /> A skill for this chapter</p>
              <h2 id="craft-focus-heading" className="ws-h2">Craft focus</h2>
            </div>
            <button type="button" className="ws-link-btn" onClick={() => dispatch({ type: 'NAV', screen: 'craft-library' })}>
              Library <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </div>
          {craftFocus ? (
            <button type="button" className="ws-focus" style={toneVars(craftFocus.dimension)} onClick={() => dispatch({ type: 'NAV', screen: 'craft-library' })}>
              {(() => {
                const Glyph = DIMENSIONS[craftFocus.dimension].Glyph;
                return <span className="ws-medallion ws-medallion--lg ws-medallion--solid" aria-hidden="true"><Glyph size={24} /></span>;
              })()}
              <span className="ws-focus-copy">
                <span className="ws-focus-kicker">{DIMENSIONS[craftFocus.dimension].kidLabel}</span>
                <span className="ws-focus-title">{craftFocus.title}</span>
                <span className="ws-focus-meta">{craftFocus.source === 'classic' ? 'A classic master' : 'A modern master'} · {craftFocus.author}</span>
                <span className="ws-focus-quote">{craftFocus.mentorNote.length > 150 ? `${craftFocus.mentorNote.slice(0, 150).trimEnd()}…` : craftFocus.mentorNote}</span>
              </span>
            </button>
          ) : (
            <p className="ws-body">Your first craft focus appears after you finish a page.</p>
          )}
        </section>

        <section className="ws-card ws-card-pad" aria-labelledby="recent-work-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker"><BookMarked size={14} aria-hidden="true" /> The pages behind you</p>
              <h2 id="recent-work-title" className="ws-h2">Recent work</h2>
            </div>
            <button type="button" className="ws-link-btn" onClick={() => dispatch({ type: 'NAV', screen: 'journal' })}>
              Journal <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </div>
          {recent.length > 0 ? (
            <div className="ws-entry-list">{recent.map((entry) => <EntryCard key={entry.id} entry={entry} onClick={() => dispatch({ type: 'NAV', screen: 'journal' })} />)}</div>
          ) : (
            <p className="ws-note"><PenLine size={15} aria-hidden="true" /> Your first page will live here.</p>
          )}
        </section>
      </div>

      {entries.length >= 3 && (
        <section className="ws-card ws-card-pad ws-rise" style={rise(9)} aria-labelledby="journey-shape-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker"><TrendingUp size={14} aria-hidden="true" /> Patterns worth noticing</p>
              <h2 id="journey-shape-title" className="ws-h2">Your writing journey</h2>
            </div>
            <span className="ws-small">Last {Math.min(8, entries.length)} pieces</span>
          </div>
          <DimensionSparklines entries={entries} />
        </section>
      )}

      <footer className="ws-home-foot">
        <button type="button" className="ws-link-btn" onClick={openParentArea}>
          <ShieldCheck size={16} aria-hidden="true" /> For grown-ups: parent area
        </button>
      </footer>
    </div>
  );
}

function StatTile({ index, tone, Icon, label, value, unit, note }: {
  index: number;
  tone: Parameters<typeof toneVars>[0];
  Icon: typeof Flame;
  label: string;
  value: string | number;
  unit?: string;
  note: string;
}) {
  return (
    <div className="ws-card ws-stat ws-rise" style={toneVars(tone, rise(index))}>
      <span className="ws-medallion" aria-hidden="true"><Icon size={20} /></span>
      <span className="ws-stat-label">{label}</span>
      <span className="ws-stat-value">{value}{unit && <small>{unit}</small>}</span>
      <span className="ws-stat-note">{note}</span>
    </div>
  );
}
