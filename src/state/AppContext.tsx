import { createContext, useContext, useEffect, useEffectEvent, useMemo, useReducer, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { AppState } from '../types';
import { reducer } from './reducer';
import type { Action } from './actions';
import { hydrateWithResult, persistWithResult, type LocalPersistenceHealth } from './persistence';

interface Ctx {
  state: AppState;
  dispatch: Dispatch<Action>;
  localPersistence: LocalPersistenceHealth;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydration] = useState(hydrateWithResult);
  const [state, dispatch] = useReducer(reducer, hydration.state);
  const [localPersistence, setLocalPersistence] = useState(hydration.persistence);
  const persistLatest = useEffectEvent(() => persistWithResult(state));

  useEffect(() => {
    let current = true;
    const result = persistLatest();
    queueMicrotask(() => {
      if (current) setLocalPersistence(result);
    });
    return () => {
      current = false;
    };
  }, [
    state.writer,
    state.earnings,
    state.entries,
    state.memory,
    state.craft,
    state.settings,
    state.progress,
    state.version,
  ]);

  // Run onboarding if PIN not set
  useEffect(() => {
    if (!state.settings.parentPinHash && state.screen !== 'onboarding') {
      dispatch({ type: 'NAV_RESET', screen: 'onboarding' });
    }
  }, [state.settings.parentPinHash, state.screen]);

  const ctx = useMemo(() => ({ state, dispatch, localPersistence }), [state, localPersistence]);
  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

// Kept beside its context so every consumer shares the same private context instance.
// eslint-disable-next-line react-refresh/only-export-components -- moving this hook would require a broad consumer-file migration
export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
