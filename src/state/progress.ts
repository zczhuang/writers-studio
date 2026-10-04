import type { Entry, EntryVersion, ProgressBaseline, ProgressHistory, ProgressOperation, WriterState } from '../types';
import { uuid } from '../utils/id';
import { stableId, stableStringify } from '../utils/stable';

type CounterSnapshot = Pick<WriterState, 'xp' | 'totalWords' | 'totalChallenges'>;

function safeCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeXp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function baselineFingerprint(counters: CounterSnapshot, entryIds: string[]): string {
  return stableId({
    xp: safeXp(counters.xp),
    totalWords: safeCounter(counters.totalWords),
    totalChallenges: safeCounter(counters.totalChallenges),
    entryIds: [...entryIds].sort(),
  });
}

export function makeBaseline(
  counters: CounterSnapshot,
  entryIds: string[],
  provenance: ProgressBaseline['provenance'],
  now = Date.now(),
): ProgressBaseline {
  const fingerprint = baselineFingerprint(counters, entryIds);
  return {
    id: `baseline-${fingerprint}-${uuid()}`,
    createdAt: now,
    provenance,
    fingerprint,
    xp: safeXp(counters.xp),
    totalWords: safeCounter(counters.totalWords),
    totalChallenges: safeCounter(counters.totalChallenges),
  };
}

export function makeProgressHistory(
  counters: CounterSnapshot = { xp: 0, totalWords: 0, totalChallenges: 0 },
  entryIds: string[] = [],
  provenance: ProgressBaseline['provenance'] = 'fresh',
  now = Date.now(),
): ProgressHistory {
  return {
    lineageId: uuid(),
    generation: uuid(),
    baseline: makeBaseline(counters, entryIds, provenance, now),
    baselineConflicts: [],
    operations: [],
    updatedAt: now,
  };
}

function expectedFirstDraftXp(version: EntryVersion): number {
  return 20
    + Math.round(version.judge.score * 0.5)
    + version.judge.breakdown.imagery * 2
    + version.judge.breakdown.originality * 2;
}

function sameNumber(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
}

function operationOrder(left: ProgressOperation, right: ProgressOperation): number {
  return left.createdAt - right.createdAt
    || left.id.localeCompare(right.id)
    || stableStringify(left).localeCompare(stableStringify(right));
}

interface RewardProofIndex {
  entriesById: Map<string, Entry>;
  versionsById: Map<string, EntryVersion[]>;
}

function rewardProofIndex(entries: Entry[]): RewardProofIndex {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const versionsById = new Map<string, EntryVersion[]>();
  for (const entry of entries) {
    for (const version of entry.versions ?? []) {
      const rows = versionsById.get(version.id) ?? [];
      rows.push(version);
      versionsById.set(version.id, rows);
    }
  }
  return { entriesById, versionsById };
}

function operationMatchesRewardFactsWithIndex(operation: ProgressOperation, index: RewardProofIndex): boolean {
  const entry = index.entriesById.get(operation.entryId);
  const matchingVersions = index.versionsById.get(operation.versionId) ?? [];
  if (!entry || matchingVersions.length !== 1) return false;
  const version = matchingVersions[0];
  if (version.entryId !== entry.id || version.gradingComplete === false || operation.createdAt !== version.createdAt) return false;

  if (operation.kind === 'entry-submit') {
    const firstDraft = entry.firstDraft;
    const expectedXp = expectedFirstDraftXp(version);
    return (
      operation.id === `submit:${entry.id}`
      && version.kind === 'first-draft'
      && operation.versionId === firstDraft?.versionId
      && firstDraft.createdAt === version.createdAt
      && firstDraft.wordCount === version.wordCount
      && sameNumber(firstDraft.xpAwarded, expectedXp)
      && operation.totalWordsDelta === version.wordCount
      && operation.totalChallengesDelta === 1
      && sameNumber(operation.xpDelta, expectedXp)
      && sameNumber(version.xpDelta, operation.xpDelta)
    );
  }

  return (
    operation.kind === 'entry-revision'
    && operation.id === `revision:${entry.id}:${version.id}`
    && version.kind === 'revision'
    && operation.totalWordsDelta === 0
    && operation.totalChallengesDelta === 0
    && sameNumber(operation.xpDelta, 8)
    && sameNumber(version.xpDelta, 8)
  );
}

/** Candidate-level proof used before same-ID operation conflicts choose a winner. */
export function operationMatchesRewardFacts(operation: ProgressOperation, entries: Entry[]): boolean {
  return operationMatchesRewardFactsWithIndex(operation, rewardProofIndex(entries));
}

/**
 * Returns only operations whose immutable entry/version facts prove the reward.
 * All history remains stored, but conflicting/excess revisions are read-only.
 */
export function rewardEligibleOperations(progress: ProgressHistory, entries: Entry[]): ProgressOperation[] {
  const proofIndex = rewardProofIndex(entries);

  const seenIds = new Set<string>();
  const submit: ProgressOperation[] = [];
  const revisions = new Map<string, ProgressOperation[]>();
  for (const operation of progress.operations) {
    if (!operation.id.trim() || seenIds.has(operation.id) || operation.baselineId !== progress.baseline.id) continue;
    seenIds.add(operation.id);
    if (!operationMatchesRewardFactsWithIndex(operation, proofIndex)) continue;

    if (operation.kind === 'entry-submit') {
      submit.push(operation);
      continue;
    }

    const rows = revisions.get(operation.entryId) ?? [];
    rows.push(operation);
    revisions.set(operation.entryId, rows);
  }

  const accepted = [...submit];
  for (const rows of revisions.values()) accepted.push(...rows.sort(operationOrder).slice(0, 2));
  return accepted.sort(operationOrder);
}

export function acceptedRevisionVersionIds(progress: ProgressHistory, entries: Entry[]): Set<string> {
  return new Set(
    rewardEligibleOperations(progress, entries)
      .filter((operation) => operation.kind === 'entry-revision')
      .map((operation) => operation.versionId),
  );
}

export function operationTotals(progress: ProgressHistory, entries: Entry[]): CounterSnapshot {
  let xp = safeXp(progress.baseline.xp);
  let totalWords = progress.baseline.totalWords;
  let totalChallenges = progress.baseline.totalChallenges;
  for (const operation of rewardEligibleOperations(progress, entries)) {
    xp += safeXp(operation.xpDelta);
    totalWords += safeCounter(operation.totalWordsDelta);
    totalChallenges += safeCounter(operation.totalChallengesDelta);
  }
  return { xp, totalWords, totalChallenges };
}

export function appendProgressOperation(progress: ProgressHistory, operation: Omit<ProgressOperation, 'baselineId'>): ProgressHistory {
  if (progress.operations.some((existing) => existing.id === operation.id)) return progress;
  return {
    ...progress,
    operations: [...progress.operations, { ...operation, baselineId: progress.baseline.id }],
    updatedAt: Math.max(progress.updatedAt, operation.createdAt),
  };
}

export function touchProgress(progress: ProgressHistory, now = Date.now()): ProgressHistory {
  return { ...progress, updatedAt: Math.max(progress.updatedAt + 1, now) };
}
