import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { startLocalDayWatcher, summarizeDailyCap } from '../services/dailyCap';
import { todayISO } from '../utils/date';

export function useDailyCap() {
  const { state } = useApp();
  const [localDay, setLocalDay] = useState(() => todayISO());

  useEffect(
    () =>
      startLocalDayWatcher(localDay, setLocalDay, {
        now: () => Date.now(),
        setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clearTimer: (timerId) => window.clearTimeout(timerId),
        subscribeFocus: (callback) => {
          window.addEventListener('focus', callback);
          return () => window.removeEventListener('focus', callback);
        },
        subscribeVisible: (callback) => {
          const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') callback();
          };
          document.addEventListener('visibilitychange', onVisibilityChange);
          return () => document.removeEventListener('visibilitychange', onVisibilityChange);
        },
      }),
    [localDay]
  );

  return useMemo(
    () => ({
      ...summarizeDailyCap(state.earnings.ledger, state.settings.dailyCapDollars, localDay),
      localDay,
    }),
    [localDay, state.earnings.ledger, state.settings.dailyCapDollars]
  );
}
