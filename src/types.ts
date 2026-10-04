export type Mode = 'scene' | 'story' | 'mystery' | 'upgrade';
export type Tier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
export type LedgerStatus = 'pending' | 'paid' | 'forfeited';
export type JudgeSource = 'gemini' | 'heuristic';

export interface JudgeBreakdown {
  vocabulary: number;
  imagery: number;
  voice: number;
  structure: number;
  originality: number;
}

export interface JudgeResult {
  score: number;
  tier: Tier;
  breakdown: JudgeBreakdown;
  strengths: string[];
  suggestions: string[];
  celebrate: string;
  source: JudgeSource;
}

export interface Entry {
  id: string;
  date: string;
  createdAt: number;
  mode: Mode;
  challengeId: string;
  challengeTitle: string;
  prompt: string;
  text: string;
  wordCount: number;
  judge: JudgeResult;
  earningsId: string;
  /** How many times this piece has been revised and resubmitted (0 = first draft). */
  revisionCount?: number;
}

export interface LedgerEntry {
  id: string;
  entryId: string;
  amount: number;
  tier: Tier;
  status: LedgerStatus;
  createdAt: number;
  paidAt?: number;
  paidNote?: string;
}

export interface Earnings {
  ledger: LedgerEntry[];
  lifetimePaid: number;
  lifetimePending: number;
}

export interface Achievement {
  id: string;
  unlockedAt: number;
}

export interface ActiveQuest {
  questId: string;
  completedSteps: string[];
  startedAt: number;
}

/**
 * Persistent writer-memory: the coach's running sense of THIS writer, built up
 * across every graded piece. It personalizes feedback, drives the "did you
 * grow?" callback, and powers adaptive prompt + skill recommendations. It never
 * changes a score — only tone, targeting, and which suggestion is emphasized.
 * Stays fully on-device (part of the localStorage AppState).
 */
export interface WriterMemory {
  /** EWMA of each dimension's 0–10 score — the coach's read on current skill. */
  mastery: JudgeBreakdown;
  /** How many graded pieces have been folded in (confidence / warm-up gate). */
  sampleCount: number;
  /** Pieces written per mode. */
  piecesByMode: Record<Mode, number>;
  /** Strongest / weakest dimension right now (derived from mastery). */
  strength: keyof JudgeBreakdown | null;
  growthEdge: keyof JudgeBreakdown | null;
  /** The dimension the coach last targeted in each mode — basis of the "did you grow?" callback. */
  growthTargetByMode: Partial<Record<Mode, keyof JudgeBreakdown>>;
  /** Set after each fold: did the writer improve on the dimension we last targeted? */
  lastGrowth: { dimension: keyof JudgeBreakdown; improved: boolean; mode: Mode } | null;
  /** A small vault of vivid words the writer has used well. */
  vocabularyVault: string[];
  /** Skill-card ids recently surfaced as "recommended" (ring buffer) to avoid repeats. */
  recentlyShownSkills: string[];
  /** Source of the last recommended card, so recommendations alternate classic/contemporary. */
  lastSkillSource: 'classic' | 'contemporary' | null;
  bestScore: number;
  updatedAt: number;
}

/** Progress through the Craft Skills library (separate from coaching memory). */
export interface CraftState {
  /** Skill-card ids the writer has opened/practiced at least once. */
  practicedSkills: string[];
  /** Skill-card ids the writer has marked as mastered. */
  masteredSkills: string[];
}

export interface WriterState {
  name: string;
  xp: number;
  streak: number;
  bestStreak: number;
  graceTokens: number;
  lastPlayDate: string | null;
  totalWords: number;
  totalChallenges: number;
  maxScore: number;
  modesPlayed: Mode[];
  achievements: Achievement[];
  activeQuests: ActiveQuest[];
}

export interface Settings {
  parentPinHash: string | null;
  parentPinSalt: string;
  geminiApiKey: string | null;
  geminiModel: string;
  dailyCapDollars: number;
  capBehavior: 'lock' | 'forfeit';
  audienceAge: number;
}

export type Screen =
  | 'home'
  | 'mode-list'
  | 'write'
  | 'result'
  | 'wallet'
  | 'journal'
  | 'badges'
  | 'craft-library'
  | 'parent-gate'
  | 'parent-dashboard'
  | 'settings'
  | 'onboarding';

export interface AppState {
  version: 3;
  writer: WriterState;
  earnings: Earnings;
  entries: Entry[];
  memory: WriterMemory;
  craft: CraftState;
  settings: Settings;
  // Ephemeral (not persisted):
  screen: Screen;
  navStack: Screen[];
  currentMode: Mode | null;
  currentChallengeId: string | null;
  lastJudge: JudgeResult | null;
  lastEntryId: string | null;
  /** When set, the WriteScreen is revising this existing entry rather than starting fresh. */
  revisingEntryId: string | null;
  parentUnlockedUntil: number;
  /** When parent-gate succeeds, where to navigate next. */
  parentGateTarget: Screen | null;
}

export interface Challenge {
  id: string;
  title: string;
  prompt: string;
  questions?: string[];
  targetWords: [number, number];
  skill: string;
  /** Optional foreign key into SKILL_CARDS — the craft technique this prompt best exercises. */
  skillId?: string;
  /** Dimension(s) this prompt most exercises — used for adaptive prompt selection. */
  dimensions?: (keyof JudgeBreakdown)[];
  visual?: string;
  original?: string;
  hint?: string;
  answer?: string;
}

export interface Level {
  id: string;
  name: string;
  min: number;
  max: number;
  icon: string;
}

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  check: (s: { writer: WriterState; entries: Entry[]; earnings: Earnings }) => boolean;
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  bonusDollars: number;
  steps: {
    title: string;
    description: string;
    mode?: Mode;
    minTier?: Tier;
  }[];
}
