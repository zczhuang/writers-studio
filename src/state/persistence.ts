import type { AppState } from '../types';
import { CURRENT_VERSION, STORAGE_KEY, makeInitialState } from './initialState';

const EPHEMERAL: (keyof AppState)[] = [
  'screen',
  'navStack',
  'currentMode',
  'currentChallengeId',
  'lastJudge',
  'lastEntryId',
  'parentUnlockedUntil',
  'parentGateTarget',
];

export function persist(state: AppState): void {
  const copy: Record<string, unknown> = { ...state };
  for (const key of EPHEMERAL) delete copy[key as string];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  } catch (e) {
    console.warn('persist failed', e);
  }
}

const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  2: (s) => s,
};

export function hydrate(): AppState {
  const fresh = makeInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    let migrated = parsed;
    while ((migrated.version ?? 0) < CURRENT_VERSION) {
      const next = (migrated.version ?? 0) + 1;
      if (!migrations[next]) break;
      migrated = migrations[next](migrated);
      migrated.version = next;
    }
    return {
      ...fresh,
      ...migrated,
      writer: { ...fresh.writer, ...(migrated.writer ?? {}) },
      earnings: { ...fresh.earnings, ...(migrated.earnings ?? {}) },
      settings: { ...fresh.settings, ...(migrated.settings ?? {}) },
      entries: Array.isArray(migrated.entries) ? migrated.entries : [],
      // ephemeral defaults
      screen: 'home',
      navStack: [],
      currentMode: null,
      currentChallengeId: null,
      lastJudge: null,
      lastEntryId: null,
      parentUnlockedUntil: 0,
      parentGateTarget: null,
    };
  } catch (e) {
    console.warn('hydrate failed', e);
    return fresh;
  }
}

export function clearPersistence(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Also clear drafts
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ws_draft_')) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
