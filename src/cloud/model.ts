import type {
  ActiveQuest,
  AppState,
  CraftState,
  Earnings,
  Entry,
  EntryVersion,
  LedgerEntry,
  ProgressBaseline,
  ProgressHistory,
  ProgressOperation,
  Settings,
  WriterState,
} from '../types';
import { applyRevisionPolicy, ensureEntryVersions, hasMeaningfulProgress, maxHistoricalScore, normalizeAppState, reconcileMemory } from '../state/normalization';
import { baselineFingerprint, operationMatchesRewardFacts, operationTotals, rewardEligibleOperations } from '../state/progress';
import { stableId, stableStringify } from '../utils/stable';

export type SafeSettings = Pick<Settings, 'geminiModel' | 'dailyCapDollars' | 'capBehavior' | 'audienceAge'>;

export interface CloudPayload {
  version: 4;
  writer: WriterState;
  earnings: Earnings;
  entries: Entry[];
  memory: AppState['memory'];
  craft: CraftState;
  settings: SafeSettings;
  progress: ProgressHistory;
}

export interface EntryVersionUpload {
  entry_id: string;
  version_id: string;
  version_payload: EntryVersion;
}

export interface ExportBundle {
  format: 'writers-studio-backup';
  formatVersion: 1;
  exportedAt: string;
  recovery: {
    lineageId: string;
    generation: string;
    note: string;
  };
  state: CloudPayload;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Explicit allowlist. Device PINs, Gemini keys, auth, navigation, and unlock state cannot enter this payload. */
export function toCloudPayload(state: AppState): CloudPayload {
  return clone({
    version: 4,
    writer: state.writer,
    earnings: state.earnings,
    entries: state.entries,
    memory: state.memory,
    craft: state.craft,
    settings: {
      geminiModel: state.settings.geminiModel,
      dailyCapDollars: state.settings.dailyCapDollars,
      capBehavior: state.settings.capBehavior,
      audienceAge: state.settings.audienceAge,
    },
    progress: state.progress,
  });
}

export function entryVersionUploads(payload: CloudPayload): EntryVersionUpload[] {
  const uploads: EntryVersionUpload[] = [];
  for (const entry of payload.entries) {
    for (const version of ensureEntryVersions(entry)) {
      uploads.push({ entry_id: entry.id, version_id: version.id, version_payload: clone(version) });
    }
  }
  return uploads;
}

export function createExportBundle(state: AppState, now = new Date()): ExportBundle {
  return {
    format: 'writers-studio-backup',
    formatVersion: 1,
    exportedAt: now.toISOString(),
    recovery: {
      lineageId: state.progress.lineageId,
      generation: state.progress.generation,
      note: 'This file contains writing history, not the private cloud recovery code.',
    },
    state: toCloudPayload(state),
  };
}

export function parseImportBundle(raw: unknown): AppState {
  let parsed = raw;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed) as unknown;
  if (parsed && typeof parsed === 'object' && 'state' in parsed) parsed = (parsed as { state: unknown }).state;
  return normalizeAppState(parsed, 'import');
}

function unionStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort((left, right) => left.localeCompare(right));
}

function mergeQuests(a: ActiveQuest[], b: ActiveQuest[]): ActiveQuest[] {
  const merged = new Map<string, ActiveQuest>();
  for (const quest of [...a, ...b]) {
    const current = merged.get(quest.questId);
    if (!current) merged.set(quest.questId, clone(quest));
    else {
      merged.set(quest.questId, {
        questId: quest.questId,
        completedSteps: unionStrings(current.completedSteps, quest.completedSteps),
        startedAt: Math.min(current.startedAt, quest.startedAt),
      });
    }
  }
  return [...merged.values()].sort((left, right) => left.questId.localeCompare(right.questId));
}

function terminalRank(status: LedgerEntry['status']): number {
  if (status === 'paid') return 3;
  if (status === 'forfeited') return 2;
  return 1;
}

function deterministicRow<T>(a: T, b: T): T {
  return stableStringify(a).localeCompare(stableStringify(b)) <= 0 ? a : b;
}

export function mergeLedgerRow(a: LedgerEntry, b: LedgerEntry): LedgerEntry {
  const aRank = terminalRank(a.status);
  const bRank = terminalRank(b.status);
  if (aRank !== bRank) return clone(aRank > bRank ? a : b);
  if (a.status === 'pending' && b.status === 'pending') {
    if (a.amount !== b.amount) return clone(a.amount > b.amount ? a : b);
    return clone(deterministicRow(a, b));
  }
  if (a.status === 'paid' && b.status === 'paid') {
    const aPaid = a.paidAt ?? Number.MAX_SAFE_INTEGER;
    const bPaid = b.paidAt ?? Number.MAX_SAFE_INTEGER;
    if (aPaid !== bPaid) return clone(aPaid < bPaid ? a : b);
  }
  // Terminal rows are never patched together: one complete historical fact wins.
  return clone(deterministicRow(a, b));
}

function mergeEarnings(local: Earnings, remote: Earnings): Earnings {
  const groups = new Map<string, { canonical: LedgerEntry[]; conflicts: LedgerEntry[] }>();
  for (const source of [...local.ledger, ...remote.ledger]) {
    const row = clone(source);
    const conflictAt = row.id.indexOf('~conflict-');
    const rootId = conflictAt >= 0 ? row.id.slice(0, conflictAt) : row.id;
    const group = groups.get(rootId) ?? { canonical: [], conflicts: [] };
    (conflictAt >= 0 ? group.conflicts : group.canonical).push(row);
    groups.set(rootId, group);
  }

  const rows = new Map<string, LedgerEntry>();
  for (const [rootId, group] of groups) {
    const candidates = [...new Map(group.canonical.map((row) => [stableStringify({ ...row, id: rootId }), row])).values()];
    let winner = candidates.shift();
    for (const candidate of candidates) winner = winner ? mergeLedgerRow(winner, candidate) : candidate;
    if (winner) rows.set(rootId, { ...winner, id: rootId });

    for (const losing of group.canonical) {
      if (winner && stableStringify({ ...losing, id: rootId }) === stableStringify({ ...winner, id: rootId })) continue;
      const conflictId = `${rootId}~conflict-${stableId({ ...losing, id: rootId })}`;
      rows.set(conflictId, { ...losing, id: conflictId, status: 'forfeited' });
    }
    for (const conflict of group.conflicts) {
      const conflictId = conflict.id.includes('~conflict-')
        ? conflict.id
        : `${rootId}~conflict-${stableId({ ...conflict, id: rootId })}`;
      const row = { ...conflict, id: conflictId, status: 'forfeited' as const };
      const current = rows.get(conflictId);
      rows.set(conflictId, current && stableStringify(current) <= stableStringify(row) ? current : row);
    }
  }
  const ledger = [...rows.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const recordedPaid = Math.max(local.lifetimePaid, remote.lifetimePaid);
  const derivedPaid = ledger.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);
  const derivedPending = ledger.filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.amount, 0);
  return {
    ledger,
    lifetimePaid: Math.max(recordedPaid, derivedPaid),
    lifetimePending: derivedPending,
  };
}

function mergeVersions(a: EntryVersion[], b: EntryVersion[]): EntryVersion[] {
  const groups = new Map<string, { canonical: EntryVersion[]; conflicts: EntryVersion[] }>();
  for (const source of [...a, ...b]) {
    const version = clone(source);
    const conflictAt = version.id.indexOf('~conflict-');
    const rootId = conflictAt >= 0 ? version.id.slice(0, conflictAt) : version.id;
    const group = groups.get(rootId) ?? { canonical: [], conflicts: [] };
    (conflictAt >= 0 || version.kind === 'conflict' ? group.conflicts : group.canonical).push(version);
    groups.set(rootId, group);
  }

  const versions = new Map<string, EntryVersion>();
  for (const [rootId, group] of groups) {
    const candidates = [...new Map(group.canonical.map((version) => [stableStringify({ ...version, id: rootId }), version])).values()]
      .sort((left, right) => stableStringify({ ...left, id: rootId }).localeCompare(stableStringify({ ...right, id: rootId })));
    const winner = candidates.shift();
    if (winner) versions.set(rootId, { ...winner, id: rootId });
    for (const losing of candidates) {
      const conflictId = `${rootId}~conflict-${stableId({ ...losing, id: rootId })}`;
      versions.set(conflictId, { ...losing, id: conflictId, kind: 'conflict' });
    }
    for (const conflict of group.conflicts) {
      const conflictId = conflict.id.includes('~conflict-')
        ? conflict.id
        : `${rootId}~conflict-${stableId({ ...conflict, id: rootId })}`;
      const row = { ...conflict, id: conflictId, kind: 'conflict' as const };
      const current = versions.get(conflictId);
      versions.set(conflictId, current && stableStringify(current) <= stableStringify(row) ? current : row);
    }
  }
  return [...versions.values()].sort((left, right) =>
    left.revision - right.revision || left.createdAt - right.createdAt || left.id.localeCompare(right.id)
  );
}

export function mergeEntry(local: Entry, remote: Entry): Entry {
  const versions = mergeVersions(ensureEntryVersions(local), ensureEntryVersions(remote));
  const pointedIds = new Set([local.currentVersionId, remote.currentVersionId].filter((id): id is string => !!id));
  const pointed = versions.filter((version) => version.kind !== 'conflict' && pointedIds.has(version.id));
  const current = [...(pointed.length ? pointed : versions.filter((version) => version.kind !== 'conflict'))]
    .sort((a, b) => b.revision - a.revision || b.createdAt - a.createdAt || b.id.localeCompare(a.id))[0]
    ?? versions[0];
  const metadata = local.createdAt === remote.createdAt
    ? deterministicRow(local, remote)
    : local.createdAt < remote.createdAt ? local : remote;
  const firstDraftCandidates = [local.firstDraft, remote.firstDraft]
    .filter((value): value is NonNullable<Entry['firstDraft']> => !!value)
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  const firstDraft = firstDraftCandidates.find((facts) =>
    versions.some((version) => version.id === facts.versionId && version.kind === 'first-draft')
  ) ?? firstDraftCandidates[0];
  return {
    ...clone(metadata),
    text: current.text,
    wordCount: current.wordCount,
    judge: clone(current.judge),
    gradingComplete: current.gradingComplete,
    revisionCount: Math.min(2, Math.max(local.revisionCount ?? 0, remote.revisionCount ?? 0)),
    versions,
    currentVersionId: current.id,
    firstDraft: firstDraft ? clone(firstDraft) : undefined,
  };
}

function mergeEntries(local: Entry[], remote: Entry[]): Entry[] {
  const entries = new Map<string, Entry>();
  for (const entry of [...local, ...remote]) {
    const current = entries.get(entry.id);
    entries.set(entry.id, current ? mergeEntry(current, entry) : clone(entry));
  }
  return [...entries.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

function baselineWeight(baseline: ProgressBaseline): [number, number, number, number, string] {
  return [baseline.totalChallenges, baseline.totalWords, baseline.xp, -baseline.createdAt, baseline.id];
}

function compareBaseline(a: ProgressBaseline, b: ProgressBaseline): number {
  const aw = baselineWeight(a);
  const bw = baselineWeight(b);
  for (let index = 0; index < aw.length; index += 1) {
    if (aw[index] === bw[index]) continue;
    return aw[index]! > bw[index]! ? 1 : -1;
  }
  return stableStringify(a).localeCompare(stableStringify(b));
}

function mergeOperations(
  a: ProgressOperation[],
  b: ProgressOperation[],
  entries: Entry[],
  baselineId: string,
): ProgressOperation[] {
  const groups = new Map<string, { canonical: ProgressOperation[]; conflicts: ProgressOperation[] }>();
  for (const source of [...a, ...b]) {
    const operation = clone(source);
    const conflictAt = operation.id.indexOf('~conflict-');
    const rootId = conflictAt >= 0 ? operation.id.slice(0, conflictAt) : operation.id;
    const group = groups.get(rootId) ?? { canonical: [], conflicts: [] };
    (conflictAt >= 0 || operation.baselineId.startsWith('conflict:') ? group.conflicts : group.canonical).push(operation);
    groups.set(rootId, group);
  }

  const operations = new Map<string, ProgressOperation>();
  for (const [rootId, group] of groups) {
    const candidates = [...new Map(group.canonical.map((operation) => [stableStringify({ ...operation, id: rootId }), operation])).values()]
      .sort((left, right) => {
        const leftValid = left.baselineId === baselineId && operationMatchesRewardFacts({ ...left, id: rootId }, entries);
        const rightValid = right.baselineId === baselineId && operationMatchesRewardFacts({ ...right, id: rootId }, entries);
        if (leftValid !== rightValid) return leftValid ? -1 : 1;
        return stableStringify({ ...left, id: rootId }).localeCompare(stableStringify({ ...right, id: rootId }));
      });
    const winner = candidates.shift();
    if (winner) operations.set(rootId, { ...winner, id: rootId });
    for (const losing of candidates) {
      const conflictId = `${rootId}~conflict-${stableId({ ...losing, id: rootId })}`;
      operations.set(conflictId, { ...losing, id: conflictId, baselineId: `conflict:${losing.baselineId}` });
    }
    for (const conflict of group.conflicts) {
      const conflictId = conflict.id.includes('~conflict-')
        ? conflict.id
        : `${rootId}~conflict-${stableId({ ...conflict, id: rootId })}`;
      const row = {
        ...conflict,
        id: conflictId,
        baselineId: conflict.baselineId.startsWith('conflict:') ? conflict.baselineId : `conflict:${conflict.baselineId}`,
      };
      const current = operations.get(conflictId);
      operations.set(conflictId, current && stableStringify(current) <= stableStringify(row) ? current : row);
    }
  }
  return [...operations.values()].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function uniqueBaselines(baselines: ProgressBaseline[]): ProgressBaseline[] {
  const rows = new Map<string, ProgressBaseline>();
  for (const baseline of baselines.map(clone).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))) {
    if (!rows.has(baseline.id)) rows.set(baseline.id, baseline);
  }
  return [...rows.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function freshOperationsForAdoption(source: AppState, targetBaselineId: string): ProgressOperation[] {
  const baseline = source.progress.baseline;
  const isFreshZero = baseline.provenance === 'fresh'
    && baseline.xp === 0
    && baseline.totalWords === 0
    && baseline.totalChallenges === 0
    && baseline.fingerprint === baselineFingerprint({ xp: 0, totalWords: 0, totalChallenges: 0 }, []);
  if (!isFreshZero) return [];
  return rewardEligibleOperations(source.progress, source.entries).map((operation) => ({
    ...operation,
    baselineId: targetBaselineId,
  }));
}

function mergeProgress(
  localState: AppState,
  remoteState: AppState,
  adoptRemoteLineage: boolean,
  entries: Entry[],
): ProgressHistory {
  const local = localState.progress;
  const remote = remoteState.progress;
  const sameLineage = local.lineageId === remote.lineageId && local.generation === remote.generation;
  let owner = local;
  if (!sameLineage && adoptRemoteLineage) owner = remote;
  if (sameLineage && compareBaseline(remote.baseline, local.baseline) > 0) owner = remote;
  const other = owner === local ? remote : local;
  const baselineConflicts = uniqueBaselines([
    ...owner.baselineConflicts,
    ...other.baselineConflicts,
    ...(owner.baseline.id === other.baseline.id ? [] : [other.baseline]),
  ]).filter((baseline) => baseline.id !== owner.baseline.id);
  let otherOperations: ProgressOperation[];
  if (sameLineage) {
    otherOperations = other.operations;
  } else if (adoptRemoteLineage && owner === remote && other === local) {
    const rebased = freshOperationsForAdoption(localState, owner.baseline.id);
    const rebasedIds = new Set(rebased.map((operation) => operation.id));
    otherOperations = [
      ...rebased,
      ...other.operations.filter((operation) => !rebasedIds.has(operation.id)).map((operation) => ({
        ...operation,
        baselineId: `foreign:${other.lineageId}:${operation.baselineId}`,
      })),
    ];
  } else {
    otherOperations = other.operations.map((operation) => ({
      ...operation,
      baselineId: `foreign:${other.lineageId}:${operation.baselineId}`,
    }));
  }
  return {
    lineageId: owner.lineageId,
    generation: owner.generation,
    baseline: clone(owner.baseline),
    baselineConflicts,
    operations: mergeOperations(owner.operations, otherOperations, entries, owner.baseline.id),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}

function mergeWriter(local: WriterState, remote: WriterState, progress: ProgressHistory, entries: Entry[]): WriterState {
  const activity = (() => {
    if (local.lastPlayDate !== remote.lastPlayDate) {
      if (!local.lastPlayDate) return remote;
      if (!remote.lastPlayDate) return local;
      return local.lastPlayDate > remote.lastPlayDate ? local : remote;
    }
    if (local.graceTokens !== remote.graceTokens) return local.graceTokens < remote.graceTokens ? local : remote;
    return deterministicRow(
      { lastPlayDate: local.lastPlayDate, streak: local.streak, graceTokens: local.graceTokens },
      { lastPlayDate: remote.lastPlayDate, streak: remote.streak, graceTokens: remote.graceTokens },
    );
  })();
  const counters = operationTotals(progress, entries);
  const achievementMap = new Map<string, { id: string; unlockedAt: number }>();
  for (const achievement of [...local.achievements, ...remote.achievements]) {
    const current = achievementMap.get(achievement.id);
    if (!current || achievement.unlockedAt < current.unlockedAt) achievementMap.set(achievement.id, clone(achievement));
  }
  const entryMax = maxHistoricalScore(entries);
  const names = [local.name, remote.name].filter((name) => name && name !== 'Writer').sort((a, b) => a.localeCompare(b));
  return {
    name: names[0] ?? 'Writer',
    xp: counters.xp,
    streak: activity.streak,
    bestStreak: Math.max(local.bestStreak, remote.bestStreak, activity.streak),
    graceTokens: activity.graceTokens,
    lastPlayDate: activity.lastPlayDate,
    totalWords: counters.totalWords,
    totalChallenges: counters.totalChallenges,
    maxScore: Math.max(local.maxScore, remote.maxScore, entryMax),
    modesPlayed: unionStrings(local.modesPlayed, remote.modesPlayed) as WriterState['modesPlayed'],
    achievements: [...achievementMap.values()].sort((a, b) => a.unlockedAt - b.unlockedAt || a.id.localeCompare(b.id)),
    activeQuests: mergeQuests(local.activeQuests, remote.activeQuests),
  };
}

function mergeCraft(local: CraftState, remote: CraftState): CraftState {
  return {
    practicedSkills: unionStrings(local.practicedSkills, remote.practicedSkills),
    masteredSkills: unionStrings(local.masteredSkills, remote.masteredSkills),
  };
}

/**
 * Loss-averse merge. It unions stable IDs and immutable operations, never replays
 * reward actions, never sums legacy baselines, and keeps device-only secrets local.
 */
export function mergeAppStates(local: AppState, remoteInput: AppState, adoptRemoteLineage = false): AppState {
  const remote = normalizeAppState(toCloudPayload(remoteInput), 'cloud');
  const localData = normalizeAppState(toCloudPayload(local), 'cloud');
  const localMeaningful = hasMeaningfulProgress(localData);
  const remoteMeaningful = hasMeaningfulProgress(remote);
  if (!remoteMeaningful) return local;

  const immutableEntries = mergeEntries(localData.entries, remote.entries);
  const progress = mergeProgress(localData, remote, adoptRemoteLineage || !localMeaningful, immutableEntries);
  const entries = applyRevisionPolicy(immutableEntries, progress);
  const writer = mergeWriter(localData.writer, remote.writer, progress, entries);
  const earnings = mergeEarnings(localData.earnings, remote.earnings);
  const craft = mergeCraft(localData.craft, remote.craft);
  const settingsOwner = localData.progress.updatedAt === remote.progress.updatedAt
    ? deterministicRow(localData.settings, remote.settings)
    : localData.progress.updatedAt > remote.progress.updatedAt ? localData.settings : remote.settings;
  const preferredMemory = [localData.memory, remote.memory].sort((left, right) =>
    right.sampleCount - left.sampleCount
    || right.updatedAt - left.updatedAt
    || stableStringify(left).localeCompare(stableStringify(right))
  )[0];
  const memory = reconcileMemory(entries, {
    ...preferredMemory,
    recentlyShownSkills: preferredMemory.recentlyShownSkills,
    lastSkillSource: preferredMemory.lastSkillSource,
  });

  return {
    ...local,
    version: 4,
    writer,
    earnings,
    entries,
    memory,
    craft,
    settings: {
      ...local.settings,
      geminiModel: settingsOwner.geminiModel,
      dailyCapDollars: settingsOwner.dailyCapDollars,
      capBehavior: settingsOwner.capBehavior,
      audienceAge: settingsOwner.audienceAge,
      parentPinHash: local.settings.parentPinHash,
      parentPinSalt: local.settings.parentPinSalt,
      geminiApiKey: local.settings.geminiApiKey,
    },
    progress,
  };
}

export function cloudPayloadToState(payload: unknown): AppState {
  return normalizeAppState(payload, 'cloud');
}
