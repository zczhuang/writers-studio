import type { BadgeDef, Earnings, Entry, JudgeBreakdown, Mode, WriterMemory, WriterState } from '../types';
import { dimensionsForChallenge } from '../data/promptSkills';
import { MODE_META, POOLS } from '../data/prompts';
import { LEVELS, getLevel, levelProgress } from '../data/levels';
import { isoFromTimestamp } from './date';
import { hasValidGrading } from '../services/writerMemory';

export const MODE_ORDER: Mode[] = ['scene', 'story', 'mystery', 'upgrade'];

export interface RankSnapshot {
  level: ReturnType<typeof getLevel>;
  pct: number;
  nextLevel: ReturnType<typeof getLevel> | null;
  xpToNext: number;
}

export interface LevelUpSnapshot {
  gained: number;
  previousXp: number;
  previousLevel: ReturnType<typeof getLevel>;
  currentLevel: ReturnType<typeof getLevel>;
  leveledUp: boolean;
}

export interface DailyMission {
  id: 'finish-piece' | 'word-sprint' | 'mode-explorer';
  title: string;
  detail: string;
  progress: number;
  target: number;
  complete: boolean;
  action: 'start' | 'modes';
  actionLabel: string;
}

export interface ActivityDay {
  date: string;
  label: string;
  shortDate: string;
  words: number;
  entries: number;
  isToday: boolean;
}

export interface ModeProgress {
  mode: Mode;
  completed: number;
  total: number;
  pct: number;
}

export interface RecommendedChallenge {
  mode: Mode;
  challenge: (typeof POOLS)[Mode][number];
  isReplay: boolean;
  growthDimension: keyof JudgeBreakdown | null;
}

export interface BadgeProgress {
  current: number;
  target: number;
  detail: string;
}

const TIER_RANK: Record<Entry['judge']['tier'], number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

/** The exact first-submit XP formula used by the reducer, kept read-only for UI. */
export function xpForEntry(entry: Pick<Entry, 'judge' | 'revisionCount'>): number {
  if ((entry.revisionCount ?? 0) > 0) return 8;
  return 20 + Math.round(entry.judge.score * 0.5) + entry.judge.breakdown.imagery * 2 + entry.judge.breakdown.originality * 2;
}

export function rankSnapshot(xp: number): RankSnapshot {
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const progress = levelProgress(safeXp);
  const index = LEVELS.findIndex((level) => level.id === progress.level.id);
  const nextLevel = index >= 0 && index < LEVELS.length - 1 ? LEVELS[index + 1] : null;
  return {
    level: progress.level,
    pct: Number.isFinite(progress.pct) ? Math.max(0, Math.min(100, progress.pct)) : 0,
    nextLevel,
    xpToNext: nextLevel ? Math.max(0, nextLevel.min - safeXp) : 0,
  };
}

export function levelUpSnapshot(xp: number, gained: number): LevelUpSnapshot {
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const safeGain = Number.isFinite(gained) ? Math.max(0, gained) : 0;
  const previousXp = Math.max(0, safeXp - safeGain);
  const previousLevel = getLevel(previousXp);
  const currentLevel = getLevel(safeXp);
  return {
    gained: safeGain,
    previousXp,
    previousLevel,
    currentLevel,
    leveledUp: previousLevel.id !== currentLevel.id,
  };
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Stored dates are the durable calendar intent; only malformed dates use the timestamp fallback. */
function isValidStoredDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
  return localDate.getFullYear() === year && localDate.getMonth() === month - 1 && localDate.getDate() === day;
}

export function dateForEntry(entry: Pick<Entry, 'date' | 'createdAt'>): string {
  const storedDate = typeof entry.date === 'string' ? entry.date.trim() : '';
  return isValidStoredDate(storedDate) ? storedDate : isoFromTimestamp(entry.createdAt);
}

export function entriesOnDate(entries: Entry[], date: string): Entry[] {
  return entries.filter((entry) => dateForEntry(entry) === date);
}

export function modeProgress(entries: Entry[], mode: Mode): ModeProgress {
  const pool = POOLS[mode];
  const completedIds = new Set(entries.filter((entry) => entry.mode === mode).map((entry) => entry.challengeId));
  const completed = pool.filter((challenge) => completedIds.has(challenge.id)).length;
  const total = pool.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { mode, completed, total, pct: Math.max(0, Math.min(100, pct)) };
}

export function allModeProgress(entries: Entry[]): ModeProgress[] {
  return MODE_ORDER.map((mode) => modeProgress(entries, mode));
}

export function dailyMissions(entries: Entry[], date: string): DailyMission[] {
  const today = entriesOnDate(entries, date);
  const words = today.reduce((sum, entry) => sum + Math.max(0, entry.wordCount), 0);
  const modes = new Set(today.map((entry) => entry.mode));
  const pieceCount = today.length;

  return [
    {
      id: 'finish-piece',
      title: 'Finish one piece',
      detail: pieceCount > 0 ? 'A page is on the map.' : 'Choose a prompt and leave a page behind.',
      progress: Math.min(1, pieceCount),
      target: 1,
      complete: pieceCount >= 1,
      action: 'start',
      actionLabel: 'Start a page',
    },
    {
      id: 'word-sprint',
      title: 'Write 100 words',
      detail: `${Math.min(100, words)} of 100 words today`,
      progress: Math.min(100, words),
      target: 100,
      complete: words >= 100,
      action: 'start',
      actionLabel: 'Keep writing',
    },
    {
      id: 'mode-explorer',
      title: 'Explore 2 modes',
      detail: `${Math.min(2, modes.size)} of 2 worlds visited`,
      progress: Math.min(2, modes.size),
      target: 2,
      complete: modes.size >= 2,
      action: 'modes',
      actionLabel: 'Explore worlds',
    },
  ];
}

function shiftDate(date: string, offset: number): string {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + offset);
  const yyyy = shifted.getFullYear();
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function weeklyActivity(entries: Entry[], anchorDate: string): ActivityDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(anchorDate, index - 6);
    const dayEntries = entriesOnDate(entries, date);
    const localDate = new Date(`${date}T12:00:00`);
    return {
      date,
      label: localDate.toLocaleDateString('en-US', { weekday: 'short' }),
      shortDate: localDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      words: dayEntries.reduce((sum, entry) => sum + Math.max(0, entry.wordCount), 0),
      entries: dayEntries.length,
      isToday: index === 6,
    };
  });
}

export function recommendedChallenge(entries: Entry[], memory: WriterMemory): RecommendedChallenge {
  const completed = new Set(entries.map((entry) => entry.challengeId));
  const unused = MODE_ORDER.flatMap((mode) => POOLS[mode].map((challenge) => ({ mode, challenge })))
    .filter(({ challenge }) => !completed.has(challenge.id));

  if (memory.growthEdge) {
    const growthEdge = memory.growthEdge;
    const growthPick = unused.find(({ challenge }) => dimensionsForChallenge(challenge).some((dimension) => dimension === growthEdge));
    if (growthPick) return { ...growthPick, isReplay: false, growthDimension: memory.growthEdge };
  }

  if (unused.length > 0) return { ...unused[0], isReplay: false, growthDimension: null };

  const lastMode = entries.length > 0 ? entries[entries.length - 1].mode : null;
  const replayMode = MODE_ORDER.find((mode) => mode !== lastMode) ?? MODE_ORDER[0];
  const growthReplayCandidates = memory.growthEdge
    ? MODE_ORDER
        .flatMap((mode) => POOLS[mode].map((challenge) => ({ mode, challenge })))
        .filter(({ challenge }) => dimensionsForChallenge(challenge).includes(memory.growthEdge!))
    : [];
  const growthReplay = growthReplayCandidates.find(({ mode }) => mode !== lastMode) ?? growthReplayCandidates[0];
  const replay = growthReplay ?? { mode: replayMode, challenge: POOLS[replayMode][0] };
  return { ...replay, isReplay: true, growthDimension: growthReplay ? memory.growthEdge : null };
}

export function badgeProgress(
  id: string,
  state: { writer: WriterState; entries: Entry[]; earnings: Earnings },
  def?: BadgeDef
): BadgeProgress {
  const { writer, entries, earnings } = state;
  switch (id) {
    case 'first': return { current: Math.min(1, writer.totalChallenges), target: 1, detail: `${Math.min(1, writer.totalChallenges)} of 1 piece` };
    case 'streak3': return { current: Math.min(3, writer.streak), target: 3, detail: `${Math.min(3, writer.streak)} of 3 days` };
    case 'streak7': return { current: Math.min(7, writer.streak), target: 7, detail: `${Math.min(7, writer.streak)} of 7 days` };
    case 'streak14': return { current: Math.min(14, writer.streak), target: 14, detail: `${Math.min(14, writer.streak)} of 14 days` };
    case 'silver1': return { current: entries.some((entry) => hasValidGrading(entry) && TIER_RANK[entry.judge.tier] >= 2) ? 1 : 0, target: 1, detail: 'First Silver page' };
    case 'gold1': return { current: entries.some((entry) => hasValidGrading(entry) && TIER_RANK[entry.judge.tier] >= 3) ? 1 : 0, target: 1, detail: 'First Gold page' };
    case 'platinum1': return { current: entries.some((entry) => hasValidGrading(entry) && TIER_RANK[entry.judge.tier] >= 4) ? 1 : 0, target: 1, detail: 'First Platinum page' };
    case 'words500': return { current: Math.min(500, writer.totalWords), target: 500, detail: `${Math.min(500, writer.totalWords).toLocaleString()} of 500 words` };
    case 'words2000': return { current: Math.min(2000, writer.totalWords), target: 2000, detail: `${Math.min(2000, writer.totalWords).toLocaleString()} of 2,000 words` };
    case 'words5000': return { current: Math.min(5000, writer.totalWords), target: 5000, detail: `${Math.min(5000, writer.totalWords).toLocaleString()} of 5,000 words` };
    case 'allModes': return { current: Math.min(4, writer.modesPlayed.length), target: 4, detail: `${Math.min(4, writer.modesPlayed.length)} of 4 worlds` };
    case 'paid1': return { current: earnings.lifetimePaid > 0 ? 1 : 0, target: 1, detail: earnings.lifetimePaid > 0 ? 'First payment received' : 'Receive your first payment' };
    case 'paid10': {
      const total = earnings.lifetimePaid + earnings.lifetimePending;
      return { current: Math.min(10, total), target: 10, detail: `$${Math.min(10, total).toFixed(2)} of $10.00` };
    }
    default: return { current: 0, target: 1, detail: def?.desc ?? 'Keep writing' };
  }
}

export function badgePercent(progress: BadgeProgress): number {
  if (progress.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress.current / progress.target) * 100)));
}

export function modeLabel(mode: Mode): string {
  return MODE_META[mode].label;
}
