import type { AppState, Entry, JudgeResult, LedgerEntry, LedgerStatus, Mode, Screen, Settings, Tier, WriterState } from '../types';

export type Action =
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'NAV'; screen: Screen }
  | { type: 'NAV_BACK' }
  | { type: 'NAV_RESET'; screen: Screen }
  | { type: 'PICK_MODE'; mode: Mode }
  | { type: 'PICK_CHALLENGE'; challengeId: string }
  | { type: 'SUBMIT_ENTRY'; entry: Entry; ledger: LedgerEntry }
  | { type: 'START_REVISION'; entryId: string }
  | { type: 'CANCEL_REVISION' }
  | { type: 'REVISE_ENTRY'; entryId: string; text: string; wordCount: number; judge: JudgeResult; ledgerPatch: { amount: number; tier: Tier; status: LedgerStatus } }
  | { type: 'CLEAR_LAST_JUDGE' }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'UNLOCK_PARENT'; untilMs: number }
  | { type: 'LOCK_PARENT' }
  | { type: 'REQUEST_PARENT_GATE'; target: Screen }
  | { type: 'PAY_LEDGER'; ids: string[]; note?: string }
  | { type: 'UPDATE_WRITER'; patch: Partial<WriterState> }
  | { type: 'UNLOCK_ACHIEVEMENTS'; ids: string[] }
  | { type: 'MARK_SKILL_PRACTICED'; id: string }
  | { type: 'MARK_SKILL_MASTERED'; id: string }
  | { type: 'RESET_ALL' };
