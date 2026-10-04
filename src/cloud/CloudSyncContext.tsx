import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useApp } from '../state/AppContext';
import { parentAccessIsActive } from '../services/accessTiming';
import {
  archiveCloudMetaBeforeNewLineage,
  archiveAndDetachCloudMeta,
  readCloudMeta,
  writeCloudMeta,
} from './recovery';
import { SyncEngine, type CloudStatus, type RecoveryResult } from './syncEngine';
import { createSupabaseTransport, readSupabaseConfig } from './transport';

interface CloudSyncContextValue {
  configured: boolean;
  status: CloudStatus;
  retry: () => void;
  recover: (code: string, parentUnlockedUntil: number) => Promise<RecoveryResult>;
  getRecoveryCode: (parentUnlockedUntil: number) => string | null;
  startNewLineage: () => boolean;
}

const DEFAULT_STATUS: CloudStatus = {
  phase: 'unavailable',
  message: 'Cloud backup is not configured',
  lastSavedAt: null,
};

const CloudSyncContext = createContext<CloudSyncContextValue>({
  configured: false,
  status: DEFAULT_STATUS,
  retry: () => undefined,
  recover: async () => ({ ok: false, reason: 'unavailable' }),
  getRecoveryCode: () => null,
  startNewLineage: () => false,
});

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const stateRef = useRef(state);
  const engineRef = useRef<SyncEngine | null>(null);
  const [status, setStatus] = useState<CloudStatus>(DEFAULT_STATUS);
  const config = useMemo(() => readSupabaseConfig(), []);
  const transport = useMemo(() => (config ? createSupabaseTransport(config) : null), [config]);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const engine = new SyncEngine({
      transport,
      getState: () => stateRef.current,
      applyState: (next) => {
        stateRef.current = next;
        dispatch({ type: 'APPLY_SYNC_STATE', payload: next });
      },
      getMeta: readCloudMeta,
      setMeta: writeCloudMeta,
      archiveCurrentMeta: archiveAndDetachCloudMeta,
      isOnline: () => navigator.onLine,
      onStatus: setStatus,
    });
    engineRef.current = engine;
    engine.start();
    const retry = () => void engine.requestSync();
    // Hiding or closing the tab flushes right away instead of waiting for the edit debounce
    // (kids often close an iPad tab seconds after finishing); coming back pulls other devices' changes.
    const onVisibility = () => void engine.requestSync();
    window.addEventListener('online', retry);
    window.addEventListener('pagehide', retry);
    document.addEventListener('visibilitychange', onVisibility);
    const unsubscribeAuth = transport?.onAuthChange(retry);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('pagehide', retry);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribeAuth?.();
      engine.stop();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [dispatch, transport]);

  useEffect(() => {
    const timer = window.setTimeout(() => void engineRef.current?.requestSync(), 650);
    return () => window.clearTimeout(timer);
  }, [
    state.writer,
    state.earnings,
    state.entries,
    state.memory,
    state.craft,
    state.settings.geminiModel,
    state.settings.dailyCapDollars,
    state.settings.capBehavior,
    state.settings.audienceAge,
    state.progress,
  ]);

  const retry = useCallback(() => void engineRef.current?.requestSync(), []);

  const recover = useCallback(
    (code: string, parentUnlockedUntil: number) => {
      const engine = engineRef.current;
      if (!engine) return Promise.resolve<RecoveryResult>({ ok: false, reason: 'unavailable' });
      return engine.recover(code, () => parentAccessIsActive(parentUnlockedUntil));
    },
    [],
  );

  const getRecoveryCode = useCallback((parentUnlockedUntil: number) => {
    if (!parentAccessIsActive(parentUnlockedUntil)) return null;
    const meta = readCloudMeta();
    const progress = stateRef.current.progress;
    if (meta?.lineageId !== progress.lineageId || meta.generation !== progress.generation) return null;
    return meta.spaceId ? meta.recoveryCode : null;
  }, []);

  const startNewLineage = useCallback(() => {
    return archiveCloudMetaBeforeNewLineage(() => engineRef.current?.invalidate());
  }, []);

  const value = useMemo<CloudSyncContextValue>(
    () => ({ configured: !!config, status, retry, recover, getRecoveryCode, startNewLineage }),
    [config, getRecoveryCode, recover, retry, startNewLineage, status],
  );

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context and hook intentionally share one private instance
export function useCloudSync(): CloudSyncContextValue {
  return useContext(CloudSyncContext);
}
