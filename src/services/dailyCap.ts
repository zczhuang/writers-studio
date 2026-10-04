import type { LedgerEntry, LedgerStatus, Tier } from '../types';
import { isoFromTimestamp, todayISO } from '../utils/date';
import { tierToDollars } from './scoring';

const ROLLOVER_GRACE_MS = 50;

const toCents = (amount: number): number => Math.round(amount * 100);
const fromCents = (amount: number): number => amount / 100;

export interface DailyCapSummary {
  earnedToday: number;
  cap: number;
  remaining: number;
  capHit: boolean;
  pct: number;
}

export interface FreshRewardDecision {
  accepted: boolean;
  amount: number;
  status: LedgerStatus;
}

interface ResolveFreshRewardInput {
  ledgerEntries: LedgerEntry[];
  candidateTier: Tier;
  dailyCapDollars: number;
  capBehavior: 'lock' | 'forfeit';
  nowMs: number;
}

export interface LocalDayWatcherRuntime {
  now: () => number;
  setTimer: (callback: () => void, delayMs: number) => number;
  clearTimer: (timerId: number) => void;
  subscribeFocus: (callback: () => void) => () => void;
  subscribeVisible: (callback: () => void) => () => void;
}

export function summarizeDailyCap(
  ledgerEntries: LedgerEntry[],
  dailyCapDollars: number,
  localDay: string
): DailyCapSummary {
  const earnedCents = ledgerEntries
    .filter((row) => row.status !== 'forfeited' && isoFromTimestamp(row.createdAt) === localDay)
    .reduce((sum, row) => sum + toCents(row.amount), 0);
  const capCents = Math.max(0, toCents(dailyCapDollars));
  const remainingCents = Math.max(0, capCents - earnedCents);

  return {
    earnedToday: fromCents(earnedCents),
    cap: fromCents(capCents),
    remaining: fromCents(remainingCents),
    capHit: earnedCents >= capCents,
    pct: capCents === 0 ? 100 : Math.min(100, Math.round((earnedCents / capCents) * 100)),
  };
}

/**
 * Resolve a new piece's reward from durable ledger data, never from a caller's
 * proposed amount. Lock mode rejects a new piece once the cap is already full;
 * both modes clip an otherwise valid reward to the exact room left today.
 */
export function resolveFreshReward({
  ledgerEntries,
  candidateTier,
  dailyCapDollars,
  capBehavior,
  nowMs,
}: ResolveFreshRewardInput): FreshRewardDecision {
  const summary = summarizeDailyCap(ledgerEntries, dailyCapDollars, isoFromTimestamp(nowMs));

  if (capBehavior === 'lock' && summary.capHit) {
    return { accepted: false, amount: 0, status: 'forfeited' };
  }

  const nominalCents = toCents(tierToDollars(candidateTier));
  const awardedCents = Math.min(nominalCents, toCents(summary.remaining));
  return {
    accepted: true,
    amount: fromCents(awardedCents),
    status: awardedCents > 0 ? 'pending' : 'forfeited',
  };
}

/** A stable daytime instant for presentation-only same-local-day comparisons. */
export function timestampForLocalDay(localDay: string): number {
  const [year, month, day] = localDay.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

function millisecondsUntilNextLocalDay(nowMs: number): number {
  const now = new Date(nowMs);
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, nextDay.getTime() - nowMs + ROLLOVER_GRACE_MS);
}

/**
 * Keep a mounted view on the current local day. Focus and visibility listeners
 * cover browsers that defer the midnight timer while a device is asleep.
 */
export function startLocalDayWatcher(
  initialDay: string,
  onDayChange: (localDay: string) => void,
  runtime: LocalDayWatcherRuntime
): () => void {
  let activeDay = initialDay;
  let timerId: number | null = null;
  let stopped = false;

  const schedule = () => {
    if (timerId !== null) runtime.clearTimer(timerId);
    timerId = runtime.setTimer(resync, millisecondsUntilNextLocalDay(runtime.now()));
  };

  const resync = () => {
    if (stopped) return;
    const nextDay = todayISO(new Date(runtime.now()));
    if (nextDay !== activeDay) {
      activeDay = nextDay;
      onDayChange(nextDay);
    }
    schedule();
  };

  const unsubscribeFocus = runtime.subscribeFocus(resync);
  const unsubscribeVisible = runtime.subscribeVisible(resync);
  resync();

  return () => {
    stopped = true;
    if (timerId !== null) runtime.clearTimer(timerId);
    unsubscribeFocus();
    unsubscribeVisible();
  };
}
