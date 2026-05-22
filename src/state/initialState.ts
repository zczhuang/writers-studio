import type { AppState } from '../types';

export const STORAGE_KEY = 'ws_state_v2';
export const DRAFT_PREFIX = 'ws_draft_';
export const CURRENT_VERSION = 2 as const;

export function makeInitialState(): AppState {
  return {
    version: CURRENT_VERSION,
    writer: {
      name: 'Writer',
      xp: 0,
      streak: 0,
      bestStreak: 0,
      graceTokens: 0,
      lastPlayDate: null,
      totalWords: 0,
      totalChallenges: 0,
      maxScore: 0,
      modesPlayed: [],
      achievements: [],
      activeQuests: [],
    },
    earnings: {
      ledger: [],
      lifetimePaid: 0,
      lifetimePending: 0,
    },
    entries: [],
    settings: {
      parentPinHash: null,
      parentPinSalt: '',
      geminiApiKey: null,
      geminiModel: 'gemini-3.1-flash-lite',
      dailyCapDollars: 1.5,
      capBehavior: 'forfeit',
      audienceAge: 12,
    },
    screen: 'home',
    navStack: [],
    currentMode: null,
    currentChallengeId: null,
    lastJudge: null,
    lastEntryId: null,
    parentUnlockedUntil: 0,
    parentGateTarget: null,
  };
}
