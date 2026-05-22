import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { AppState } from '../types';
import { reducer } from './reducer';
import type { Action } from './actions';
import { hydrate, persist } from './persistence';

interface Ctx {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, hydrate);

  useEffect(() => {
    persist(state);
  }, [
    state.writer,
    state.earnings,
    state.entries,
    state.settings,
    state.version,
  ]);

  // Run onboarding if PIN not set
  useEffect(() => {
    if (!state.settings.parentPinHash && state.screen !== 'onboarding') {
      dispatch({ type: 'NAV_RESET', screen: 'onboarding' });
    }
  }, [state.settings.parentPinHash, state.screen]);

  const ctx = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
