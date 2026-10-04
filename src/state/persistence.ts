import type { AppState } from '../types';
import { CURRENT_VERSION, DRAFT_PREFIX, STORAGE_KEY, makeInitialState } from './initialState';
import { UnsupportedSchemaVersionError, assertSupportedSchema, isRecord, normalizeAppState } from './normalization';

export const RAW_RECOVERY_PREFIX = 'ws_state_recovery_v1_';
export const RAW_RECOVERY_FIRST_KEY = `${RAW_RECOVERY_PREFIX}first`;
export const RAW_RECOVERY_LATEST_KEY = `${RAW_RECOVERY_PREFIX}latest`;

const EPHEMERAL: (keyof AppState)[] = [
  'screen',
  'navStack',
  'currentMode',
  'currentChallengeId',
  'lastJudge',
  'lastEntryId',
  'revisingEntryId',
  'parentUnlockedUntil',
  'parentGateTarget',
];

export type LocalPersistenceCode =
  | 'empty'
  | 'saved'
  | 'checkpoint-failed'
  | 'malformed'
  | 'unsupported-version'
  | 'write-failed';

export interface LocalPersistenceHealth {
  ok: boolean;
  code: LocalPersistenceCode;
  writesBlocked: boolean;
  rawRetained: boolean;
}

export interface HydrationResult {
  state: AppState;
  persistence: LocalPersistenceHealth;
}

let persistenceWriteBlocked = false;
let lastHealth: LocalPersistenceHealth = {
  ok: true,
  code: 'empty',
  writesBlocked: false,
  rawRetained: false,
};

function setHealth(health: LocalPersistenceHealth): LocalPersistenceHealth {
  persistenceWriteBlocked = health.writesBlocked;
  lastHealth = health;
  return health;
}

function exactWrite(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch (error) {
    console.warn('local persistence write failed', error);
    return false;
  }
}

/** Preserve the first source forever and, at most, one rolling later recovery source. */
function checkpointRawSave(raw: string): boolean {
  try {
    const first = localStorage.getItem(RAW_RECOVERY_FIRST_KEY);
    if (first === null) return exactWrite(RAW_RECOVERY_FIRST_KEY, raw);
    if (first === raw) return true;
    return exactWrite(RAW_RECOVERY_LATEST_KEY, raw);
  } catch (error) {
    console.warn('raw recovery checkpoint failed', error);
    return false;
  }
}

export function persistenceWritesAreBlocked(): boolean {
  return persistenceWriteBlocked;
}

export function getLocalPersistenceHealth(): LocalPersistenceHealth {
  return lastHealth;
}

/** Used only after an explicit successful import/reset replaces an unreadable source. */
export function allowPersistenceWrites(): void {
  setHealth({ ok: true, code: 'empty', writesBlocked: false, rawRetained: false });
}

export function persistedState(state: AppState): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...state, version: CURRENT_VERSION };
  for (const key of EPHEMERAL) delete copy[key as string];
  return copy;
}

export function persistWithResult(state: AppState): LocalPersistenceHealth {
  if (persistenceWriteBlocked) return lastHealth;
  const serialized = JSON.stringify(persistedState(state));
  if (!exactWrite(STORAGE_KEY, serialized)) {
    let rawRetained = false;
    try {
      rawRetained = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      // The status already explains that browser storage is unavailable.
    }
    return setHealth({ ok: false, code: 'write-failed', writesBlocked: false, rawRetained });
  }
  return setHealth({ ok: true, code: 'saved', writesBlocked: false, rawRetained: true });
}

/** Compatibility wrapper for non-React callers. */
export function persist(state: AppState): boolean {
  return persistWithResult(state).ok;
}

export function hydrateWithResult(): HydrationResult {
  const fresh = makeInitialState();
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('local save could not be read', error);
    const persistence = setHealth({ ok: false, code: 'write-failed', writesBlocked: true, rawRetained: false });
    return { state: fresh, persistence };
  }

  if (raw === null) {
    const persistence = setHealth({ ok: true, code: 'empty', writesBlocked: false, rawRetained: false });
    return { state: fresh, persistence };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    checkpointRawSave(raw);
    console.warn('local save is malformed; original retained', error);
    const persistence = setHealth({ ok: false, code: 'malformed', writesBlocked: true, rawRetained: true });
    return { state: fresh, persistence };
  }

  try {
    assertSupportedSchema(parsed);
  } catch (error) {
    if (error instanceof UnsupportedSchemaVersionError) {
      checkpointRawSave(raw);
      console.warn('local save requires a newer app; original retained', error);
      const persistence = setHealth({ ok: false, code: 'unsupported-version', writesBlocked: true, rawRetained: true });
      return { state: fresh, persistence };
    }
    checkpointRawSave(raw);
    const persistence = setHealth({ ok: false, code: 'malformed', writesBlocked: true, rawRetained: true });
    return { state: fresh, persistence };
  }

  const version = isRecord(parsed) && typeof parsed.version === 'number' && Number.isFinite(parsed.version)
    ? parsed.version
    : 0;
  const needsCheckpoint = version < CURRENT_VERSION;
  const checkpointed = !needsCheckpoint || checkpointRawSave(raw);

  try {
    const state = normalizeAppState(parsed, 'local');
    if (!checkpointed) {
      const persistence = setHealth({ ok: false, code: 'checkpoint-failed', writesBlocked: true, rawRetained: true });
      return { state, persistence };
    }
    const persistence = setHealth({ ok: true, code: 'saved', writesBlocked: false, rawRetained: true });
    return { state, persistence };
  } catch (error) {
    console.warn('local save failed schema normalization; original retained', error);
    const persistence = setHealth({ ok: false, code: 'malformed', writesBlocked: true, rawRetained: true });
    return { state: fresh, persistence };
  }
}

export function hydrate(): AppState {
  return hydrateWithResult().state;
}

export interface LocalPersistencePresentation {
  label: string;
  detail: string;
  actionable: boolean;
}

export function localPersistencePresentation(health: LocalPersistenceHealth): LocalPersistencePresentation {
  switch (health.code) {
    case 'saved':
      return { label: 'Saved on this device', detail: 'This browser has the latest local copy.', actionable: false };
    case 'empty':
      return { label: 'Ready on this device', detail: 'Writing will be saved in this browser.', actionable: false };
    case 'unsupported-version':
      return { label: 'Update app to open save', detail: 'A newer save was preserved and will not be overwritten.', actionable: true };
    case 'checkpoint-failed':
      return { label: 'Recovery copy could not be made', detail: 'Writing is visible, but changes are blocked. Free browser storage or export a backup.', actionable: true };
    case 'malformed':
      return { label: 'Local save needs recovery', detail: 'The original bytes were preserved. Import a good backup or reset only after exporting.', actionable: true };
    case 'write-failed':
      return { label: 'Changes not saved locally', detail: 'Free browser storage, then make another change or export a backup.', actionable: true };
  }
}

export function clearPersistence(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const remove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(DRAFT_PREFIX)) remove.push(key);
    }
    remove.forEach((key) => localStorage.removeItem(key));
    setHealth({ ok: true, code: 'empty', writesBlocked: false, rawRetained: false });
  } catch (error) {
    console.warn('local reset could not clear browser storage', error);
    setHealth({ ok: false, code: 'write-failed', writesBlocked: false, rawRetained: true });
  }
}
