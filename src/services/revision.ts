import type { Entry, LedgerEntry, Tier } from '../types';
import { isSameDay } from '../utils/date';
import { tierToDollars } from './scoring';

export const MAX_REVISIONS = 2;

const TIER_RANK: Record<Tier, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

export type RevisionRewardAvailability =
  | 'eligible'
  | 'missing-ledger'
  | 'already-paid'
  | 'forfeited'
  | 'older-day';

export type RevisionRewardReason =
  | 'reward-increased'
  | Exclude<RevisionRewardAvailability, 'eligible'>
  | 'not-higher-tier'
  | 'cap-reached';

export interface RevisionRewardDecision {
  patch: Pick<LedgerEntry, 'amount' | 'tier' | 'status'> | null;
  addedAmount: number;
  rewardChanged: boolean;
  reason: RevisionRewardReason;
}

interface ResolveRevisionRewardInput {
  ledger: LedgerEntry | undefined;
  ledgerEntries: LedgerEntry[];
  candidateTier: Tier;
  dailyCapDollars: number;
  nowMs: number;
}

const toCents = (amount: number): number => Math.round(amount * 100);
const fromCents = (amount: number): number => amount / 100;

export function canReviseEntry(entry: Entry | null | undefined): entry is Entry {
  return !!entry && (entry.revisionCount ?? 0) < MAX_REVISIONS;
}

export function getRevisionRewardAvailability(
  ledger: LedgerEntry | undefined,
  nowMs: number
): RevisionRewardAvailability {
  if (!ledger) return 'missing-ledger';
  if (ledger.status === 'paid') return 'already-paid';
  if (ledger.status === 'forfeited') return 'forfeited';
  if (!isSameDay(ledger.createdAt, nowMs)) return 'older-day';
  return 'eligible';
}

/**
 * Resolve the only ledger mutation a revision may make.
 *
 * A closed reward (paid/forfeited), a prior-day pending reward, or a missing
 * ledger row is practice-only. For an eligible same-day pending row, only a
 * strictly higher earned tier can add money, and the addition is capped by the
 * room left today. This policy is deliberately identical for both cap modes.
 */
export function resolveRevisionReward({
  ledger,
  ledgerEntries,
  candidateTier,
  dailyCapDollars,
  nowMs,
}: ResolveRevisionRewardInput): RevisionRewardDecision {
  const availability = getRevisionRewardAvailability(ledger, nowMs);
  if (!ledger) {
    return { patch: null, addedAmount: 0, rewardChanged: false, reason: 'missing-ledger' };
  }

  const unchanged = (reason: Exclude<RevisionRewardReason, 'reward-increased'>): RevisionRewardDecision => ({
    patch: { amount: ledger.amount, tier: ledger.tier, status: ledger.status },
    addedAmount: 0,
    rewardChanged: false,
    reason,
  });

  if (availability !== 'eligible') return unchanged(availability);
  if (TIER_RANK[candidateTier] <= TIER_RANK[ledger.tier]) return unchanged('not-higher-tier');

  const currentCents = toCents(ledger.amount);
  const currentTierCents = toCents(tierToDollars(ledger.tier));
  const candidateCents = toCents(tierToDollars(candidateTier));
  const tierDifferenceCents = candidateCents - currentTierCents;
  const roomToCandidateCents = candidateCents - currentCents;
  const desiredIncreaseCents = Math.max(0, Math.min(tierDifferenceCents, roomToCandidateCents));

  const earnedTodayCents = ledgerEntries
    .filter((row) => row.status !== 'forfeited' && isSameDay(row.createdAt, nowMs))
    .reduce((sum, row) => sum + toCents(row.amount), 0);
  const remainingCents = Math.max(0, toCents(dailyCapDollars) - earnedTodayCents);
  const addedCents = Math.min(desiredIncreaseCents, remainingCents);

  if (addedCents <= 0) return unchanged('cap-reached');

  return {
    patch: {
      amount: fromCents(currentCents + addedCents),
      tier: candidateTier,
      status: ledger.status,
    },
    addedAmount: fromCents(addedCents),
    rewardChanged: true,
    reason: 'reward-increased',
  };
}
