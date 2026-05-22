import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { todayISO, isoFromTimestamp } from '../utils/date';

export function useDailyCap() {
  const { state } = useApp();
  return useMemo(() => {
    const t = todayISO();
    const earnedToday = state.earnings.ledger
      .filter((l) => l.status !== 'forfeited')
      .filter((l) => isoFromTimestamp(l.createdAt) === t)
      .reduce((s, l) => s + l.amount, 0);
    const cap = state.settings.dailyCapDollars;
    return {
      earnedToday,
      cap,
      remaining: Math.max(0, cap - earnedToday),
      capHit: earnedToday >= cap,
      pct: Math.min(100, Math.round((earnedToday / cap) * 100)),
    };
  }, [state.earnings.ledger, state.settings.dailyCapDollars]);
}
