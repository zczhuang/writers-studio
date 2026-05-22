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
  | 'parent-gate'
  | 'parent-dashboard'
  | 'settings'
  | 'onboarding';

export interface AppState {
  version: 2;
  writer: WriterState;
  earnings: Earnings;
  entries: Entry[];
  settings: Settings;
  // Ephemeral (not persisted):
  screen: Screen;
  navStack: Screen[];
  currentMode: Mode | null;
  currentChallengeId: string | null;
  lastJudge: JudgeResult | null;
  lastEntryId: string | null;
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
