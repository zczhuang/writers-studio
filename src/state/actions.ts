import type { AppState, Entry, LedgerEntry, Mode, Screen, Settings, WriterState } from '../types';

export type Action =
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'NAV'; screen: Screen }
  | { type: 'NAV_BACK' }
  | { type: 'NAV_RESET'; screen: Screen }
  | { type: 'PICK_MODE'; mode: Mode }
  | { type: 'PICK_CHALLENGE'; challengeId: string }
  | { type: 'SUBMIT_ENTRY'; entry: Entry; ledger: LedgerEntry }
  | { type: 'CLEAR_LAST_JUDGE' }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'UNLOCK_PARENT'; untilMs: number }
  | { type: 'LOCK_PARENT' }
  | { type: 'REQUEST_PARENT_GATE'; target: Screen }
  | { type: 'PAY_LEDGER'; ids: string[]; note?: string }
  | { type: 'UPDATE_WRITER'; patch: Partial<WriterState> }
  | { type: 'UNLOCK_ACHIEVEMENTS'; ids: string[] }
  | { type: 'RESET_ALL' };
