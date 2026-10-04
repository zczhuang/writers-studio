import type {
  Achievement,
  ActiveQuest,
  AppState,
  CraftState,
  Earnings,
  Entry,
  EntryVersion,
  FirstDraftFacts,
  JudgeBreakdown,
  JudgeResult,
  LedgerEntry,
  LedgerStatus,
  Mode,
  ProgressBaseline,
  ProgressHistory,
  ProgressOperation,
  Settings,
  Tier,
  WriterMemory,
  WriterState,
} from '../types';
import { mapScoreToTier } from '../services/scoring';
import { buildMemory, emptyMemory, entriesWithLatestValidGrading, hasValidGrading } from '../services/writerMemory';
import { countWords } from '../utils/text';
import { isoFromTimestamp } from '../utils/date';
import { stableId, stableStringify } from '../utils/stable';
import { CURRENT_VERSION, makeInitialState } from './initialState';
import { acceptedRevisionVersionIds, baselineFingerprint, operationMatchesRewardFacts, operationTotals } from './progress';

const MODES: Mode[] = ['scene', 'story', 'mystery', 'upgrade'];
const TIERS: Tier[] = ['none', 'bronze', 'silver', 'gold', 'platinum'];
const STATUSES: LedgerStatus[] = ['pending', 'paid', 'forfeited'];
const DIMS: (keyof JudgeBreakdown)[] = ['vocabulary', 'imagery', 'voice', 'structure', 'originality'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LEGACY_ENTRY_CAP = 500;

export class UnsupportedSchemaVersionError extends Error {
  readonly version: number;

  constructor(version: number) {
    super(`This save uses schema version ${version}, but this app supports up to ${CURRENT_VERSION}.`);
    this.name = 'UnsupportedSchemaVersionError';
    this.version = version;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nonBlankString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function counter(value: unknown, fallback = 0): number {
  return Math.max(0, Math.round(finite(value, fallback)));
}

function nonnegative(value: unknown, fallback = 0): number {
  return Math.max(0, finite(value, fallback));
}

function timestamp(value: unknown, fallback: number): number {
  const next = finite(value, fallback);
  return next > 0 ? Math.round(next) : fallback;
}

function deterministicTimestamp(seed: unknown): number {
  return 1_600_000_000_000 + Number.parseInt(stableId({ timestamp: seed }), 16);
}

function savedDateTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

function deterministicUuid(seed: unknown): string {
  const hex = [0, 1, 2, 3].map((part) => stableId({ seed, part })).join('').split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16] ?? '0', 16) % 4];
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function sortedStringArray(value: unknown): string[] {
  return stringArray(value).sort((left, right) => left.localeCompare(right));
}

function modeValue(value: unknown): Mode {
  return MODES.includes(value as Mode) ? (value as Mode) : 'scene';
}

function tierValue(value: unknown, score: number): Tier {
  return TIERS.includes(value as Tier) ? (value as Tier) : mapScoreToTier(score);
}

function normalizeJudgeValue(raw: unknown): { judge: JudgeResult; complete: boolean } {
  const source = isRecord(raw) ? raw : {};
  const breakdownSource = isRecord(source.breakdown) ? source.breakdown : {};
  const complete =
    isRecord(raw) &&
    typeof source.score === 'number' &&
    Number.isFinite(source.score) &&
    source.score >= 0 &&
    source.score <= 100 &&
    isRecord(source.breakdown) &&
    DIMS.every((dimension) =>
      typeof breakdownSource[dimension] === 'number'
      && Number.isFinite(breakdownSource[dimension])
      && (breakdownSource[dimension] as number) >= 0
      && (breakdownSource[dimension] as number) <= 10
    );
  const breakdown = {} as JudgeBreakdown;
  for (const dimension of DIMS) {
    breakdown[dimension] = Math.max(0, Math.min(10, finite(breakdownSource[dimension], 0)));
  }
  const score = Math.max(0, Math.min(100, finite(source.score, 0)));
  return {
    complete,
    judge: {
      score,
      tier: tierValue(source.tier, score),
      breakdown,
      strengths: stringArray(source.strengths).slice(0, 12),
      suggestions: stringArray(source.suggestions).slice(0, 12),
      celebrate: stringValue(source.celebrate),
      source: source.source === 'gemini' ? 'gemini' : 'heuristic',
    },
  };
}

function xpForFirstDraft(judge: JudgeResult): number {
  return 20 + Math.round(judge.score * 0.5) + judge.breakdown.imagery * 2 + judge.breakdown.originality * 2;
}

function normalizeVersion(raw: unknown, entryId: string, fallback: Entry, index: number): EntryVersion {
  const source = isRecord(raw) ? raw : {};
  // An explicit historical version without its own judge has no historical
  // grade. Borrowing the entry's current judge would fabricate old evidence.
  const normalizedJudge = normalizeJudgeValue(source.judge);
  const text = stringValue(source.text, fallback.text);
  const revision = counter(source.revision, fallback.revisionCount ?? index);
  const createdAt = timestamp(source.createdAt, fallback.createdAt + index);
  const allowedKinds: EntryVersion['kind'][] = ['first-draft', 'revision', 'legacy-current', 'conflict'];
  const kind = allowedKinds.includes(source.kind as EntryVersion['kind'])
    ? (source.kind as EntryVersion['kind'])
    : 'legacy-current';
  const derivedId = `version-${entryId}-${revision}-${stableId({ text, createdAt, judge: normalizedJudge.judge })}`;
  return {
    id: nonBlankString(source.id, derivedId),
    entryId,
    parentVersionId: typeof source.parentVersionId === 'string' ? source.parentVersionId : null,
    revision,
    kind,
    createdAt,
    text,
    wordCount: counter(source.wordCount, countWords(text)),
    judge: normalizedJudge.judge,
    gradingComplete: source.gradingComplete === false ? false : normalizedJudge.complete,
    xpDelta: nonnegative(source.xpDelta, 0),
  };
}

function dedupeVersions(versions: EntryVersion[]): EntryVersion[] {
  const groups = new Map<string, { canonical: EntryVersion[]; conflicts: EntryVersion[] }>();
  for (const version of versions) {
    const conflictAt = version.id.indexOf('~conflict-');
    const rootId = conflictAt >= 0 ? version.id.slice(0, conflictAt) : version.id;
    const group = groups.get(rootId) ?? { canonical: [], conflicts: [] };
    (conflictAt >= 0 || version.kind === 'conflict' ? group.conflicts : group.canonical).push(version);
    groups.set(rootId, group);
  }

  const byIdentity = new Map<string, EntryVersion>();
  for (const [rootId, group] of groups) {
    const candidates = [...new Map(group.canonical.map((version) => [stableStringify({ ...version, id: rootId }), version])).values()]
      .sort((left, right) => stableStringify({ ...left, id: rootId }).localeCompare(stableStringify({ ...right, id: rootId })));
    const winner = candidates.shift();
    if (winner) byIdentity.set(rootId, { ...winner, id: rootId });
    for (const losing of candidates) {
      const conflictId = `${rootId}~conflict-${stableId({ ...losing, id: rootId })}`;
      byIdentity.set(conflictId, { ...losing, id: conflictId, kind: 'conflict' });
    }
    for (const conflict of group.conflicts) {
      const conflictId = conflict.id.includes('~conflict-')
        ? conflict.id
        : `${rootId}~conflict-${stableId({ ...conflict, id: rootId })}`;
      const row = { ...conflict, id: conflictId, kind: 'conflict' as const };
      const current = byIdentity.get(conflictId);
      byIdentity.set(conflictId, current && stableStringify(current) <= stableStringify(row) ? current : row);
    }
  }
  return [...byIdentity.values()].sort((a, b) => a.revision - b.revision || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

function normalizeFirstDraft(raw: unknown, versions: EntryVersion[]): FirstDraftFacts | undefined {
  const source = isRecord(raw) ? raw : null;
  if (source) {
    const versionId = stringValue(source.versionId).trim();
    if (versionId) {
      return {
        versionId,
        createdAt: timestamp(source.createdAt, 1),
        wordCount: counter(source.wordCount),
        xpAwarded: nonnegative(source.xpAwarded),
      };
    }
  }
  const first = versions.find((version) => version.kind === 'first-draft');
  if (!first) return undefined;
  return {
    versionId: first.id,
    createdAt: first.createdAt,
    wordCount: first.wordCount,
    xpAwarded: first.xpDelta,
  };
}

export function normalizeEntry(raw: unknown, index = 0): Entry {
  const source = isRecord(raw) ? raw : {};
  const rawText = typeof raw === 'string' ? raw : source.text;
  const hasTopLevelText = typeof raw === 'string' || typeof source.text === 'string';
  const text = stringValue(rawText);
  const provenance = { kind: 'entry', index, raw };
  const createdAt = timestamp(source.createdAt, savedDateTimestamp(source.date) ?? deterministicTimestamp(provenance));
  const id = nonBlankString(source.id, `legacy-entry-${index}-${stableId({ text, createdAt, provenance })}`);
  const normalizedJudge = normalizeJudgeValue(source.judge);
  const savedDate = savedDateTimestamp(source.date);
  const entry: Entry = {
    id,
    date: savedDate === null ? isoFromTimestamp(createdAt) : stringValue(source.date).trim(),
    createdAt,
    mode: modeValue(source.mode),
    challengeId: stringValue(source.challengeId, `legacy-${id}`),
    challengeTitle: stringValue(source.challengeTitle, 'Recovered writing'),
    prompt: stringValue(source.prompt, 'Recovered from an earlier save.'),
    text,
    wordCount: counter(source.wordCount, countWords(text)),
    judge: normalizedJudge.judge,
    earningsId: nonBlankString(source.earningsId, `legacy-ledger-${id}`),
    revisionCount: Math.min(2, counter(source.revisionCount, 0)),
    gradingComplete: source.gradingComplete === false ? false : normalizedJudge.complete,
  };

  const rawVersions = Array.isArray(source.versions) ? source.versions : [];
  const normalizedVersions = rawVersions.map((version, versionIndex) => normalizeVersion(version, id, entry, versionIndex));
  const topLevelFacts = (version: EntryVersion) => (
    version.kind !== 'conflict'
    && version.text === entry.text
    && version.wordCount === entry.wordCount
    && version.gradingComplete === (entry.gradingComplete !== false)
    && stableStringify(version.judge) === stableStringify(entry.judge)
  );
  const hasRecoverableTopLevelText = hasTopLevelText && entry.text.trim().length > 0;
  if (normalizedVersions.length === 0 || (hasRecoverableTopLevelText && !normalizedVersions.some(topLevelFacts))) {
    const recoveredRevision = normalizedVersions.length === 0
      ? entry.revisionCount ?? 0
      : Math.max(entry.revisionCount ?? 0, ...normalizedVersions.map((version) => version.revision + 1));
    normalizedVersions.push({
      id: `legacy-current-${id}-${stableId({
        text: entry.text,
        wordCount: entry.wordCount,
        judge: entry.judge,
        gradingComplete: entry.gradingComplete,
        revision: recoveredRevision,
      })}`,
      entryId: id,
      parentVersionId: null,
      revision: recoveredRevision,
      kind: 'legacy-current',
      createdAt,
      text: entry.text,
      wordCount: entry.wordCount,
      judge: entry.judge,
      gradingComplete: entry.gradingComplete !== false,
      xpDelta: 0,
    });
  }
  entry.versions = dedupeVersions(normalizedVersions);
  const requestedCurrent = stringValue(source.currentVersionId);
  const recoveredTopLevel = hasRecoverableTopLevelText
    ? entry.versions.filter(topLevelFacts).sort((left, right) =>
        right.revision - left.revision
        || right.createdAt - left.createdAt
        || right.id.localeCompare(left.id)
      )[0]
    : undefined;
  entry.currentVersionId = recoveredTopLevel?.id
    ?? (entry.versions.some((version) => version.id === requestedCurrent && version.kind !== 'conflict')
      ? requestedCurrent
      : [...entry.versions].reverse().find((version) => version.kind !== 'conflict')?.id ?? entry.versions.at(-1)?.id);
  entry.firstDraft = normalizeFirstDraft(source.firstDraft, entry.versions);
  const current = entry.versions.find((version) => version.id === entry.currentVersionId);
  if (current) {
    entry.text = current.text;
    entry.wordCount = current.wordCount;
    entry.judge = current.judge;
    entry.gradingComplete = current.gradingComplete;
  }
  return entry;
}

function normalizeWriter(raw: unknown, fresh: WriterState): WriterState {
  const source = isRecord(raw) ? raw : {};
  const achievements: Achievement[] = Array.isArray(source.achievements)
    ? source.achievements.map((item, index) => {
        const row = isRecord(item) ? item : {};
        const fallbackId = `recovered-achievement-${index}-${stableId({ item, index })}`;
        return {
          id: nonBlankString(row.id, fallbackId),
          unlockedAt: timestamp(row.unlockedAt, deterministicTimestamp({ kind: 'achievement', item, index })),
        };
      })
    : [];
  const activeQuests: ActiveQuest[] = Array.isArray(source.activeQuests)
    ? source.activeQuests.map((item, index) => {
        const row = isRecord(item) ? item : {};
        const fallbackId = `recovered-quest-${index}-${stableId({ item, index })}`;
        return {
          questId: nonBlankString(row.questId, fallbackId),
          completedSteps: sortedStringArray(row.completedSteps),
          startedAt: timestamp(row.startedAt, deterministicTimestamp({ kind: 'quest', item, index })),
        };
      })
    : [];
  const modesPlayed = Array.isArray(source.modesPlayed)
    ? source.modesPlayed.filter((mode): mode is Mode => MODES.includes(mode as Mode))
    : [];
  return {
    name: stringValue(source.name, fresh.name),
    xp: nonnegative(source.xp, fresh.xp),
    streak: counter(source.streak, fresh.streak),
    bestStreak: counter(source.bestStreak, fresh.bestStreak),
    graceTokens: counter(source.graceTokens, fresh.graceTokens),
    lastPlayDate: typeof source.lastPlayDate === 'string' ? source.lastPlayDate : null,
    totalWords: counter(source.totalWords, fresh.totalWords),
    totalChallenges: counter(source.totalChallenges, fresh.totalChallenges),
    maxScore: Math.max(0, finite(source.maxScore, fresh.maxScore)),
    modesPlayed: MODES.filter((mode) => modesPlayed.includes(mode)),
    achievements: [...new Map(achievements.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))).map((row) => [row.id, row])).values()]
      .sort((left, right) => left.unlockedAt - right.unlockedAt || left.id.localeCompare(right.id)),
    activeQuests: [...new Map(activeQuests.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))).map((row) => [row.questId, row])).values()]
      .sort((left, right) => left.startedAt - right.startedAt || left.questId.localeCompare(right.questId)),
  };
}

function normalizeLedger(raw: unknown, index: number): LedgerEntry {
  const source = isRecord(raw) ? raw : {};
  const entryId = nonBlankString(source.entryId, `recovered-entry-${index}-${stableId({ raw, index })}`);
  const id = nonBlankString(source.id, `recovered-ledger-${index}-${stableId({ raw, index })}`);
  const hasPaidAt = typeof source.paidAt === 'number' && Number.isFinite(source.paidAt) && source.paidAt > 0;
  const hasPaidNote = typeof source.paidNote === 'string' && source.paidNote.trim().length > 0;
  const explicitStatus = STATUSES.includes(source.status as LedgerStatus) ? (source.status as LedgerStatus) : null;
  const quarantinedConflict = id.includes('~conflict-') && explicitStatus === 'forfeited';
  const status: LedgerStatus = quarantinedConflict
    ? 'forfeited'
    : hasPaidAt || hasPaidNote ? 'paid' : explicitStatus ?? 'forfeited';
  const row: LedgerEntry = {
    id,
    entryId,
    amount: Math.max(0, finite(source.amount, 0)),
    tier: tierValue(source.tier, 0),
    status,
    createdAt: timestamp(source.createdAt, deterministicTimestamp({ kind: 'ledger', raw, index })),
  };
  if (hasPaidAt) row.paidAt = source.paidAt as number;
  if (typeof source.paidNote === 'string') row.paidNote = source.paidNote;
  return row;
}

function preferredLedgerRow(left: LedgerEntry, right: LedgerEntry): LedgerEntry {
  const rank = (value: LedgerEntry) => value.status === 'paid' ? 3 : value.status === 'forfeited' ? 2 : 1;
  const leftRank = rank(left);
  const rightRank = rank(right);
  if (leftRank !== rightRank) return leftRank > rightRank ? left : right;
  if (left.status === 'pending' && right.status === 'pending' && left.amount !== right.amount) {
    return left.amount > right.amount ? left : right;
  }
  if (left.status === 'paid' && right.status === 'paid') {
    const leftPaidAt = left.paidAt ?? Number.MAX_SAFE_INTEGER;
    const rightPaidAt = right.paidAt ?? Number.MAX_SAFE_INTEGER;
    if (leftPaidAt !== rightPaidAt) return leftPaidAt < rightPaidAt ? left : right;
  }
  return stableStringify(left) <= stableStringify(right) ? left : right;
}

function normalizeEarnings(raw: unknown, fresh: Earnings): Earnings {
  const source = isRecord(raw) ? raw : {};
  const normalized = Array.isArray(source.ledger) ? source.ledger.map(normalizeLedger) : [];
  const byId = new Map<string, LedgerEntry>();
  for (const row of normalized.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))) {
    const current = byId.get(row.id);
    if (!current) {
      byId.set(row.id, row);
      continue;
    }
    if (stableStringify(current) === stableStringify(row)) continue;
    const winner = preferredLedgerRow(current, row);
    const losing = winner === row ? current : row;
    byId.set(row.id, winner);
    const conflictId = `${row.id}~conflict-${stableId(losing)}`;
    byId.set(conflictId, { ...losing, id: conflictId, status: 'forfeited' });
  }
  const ledger = [...byId.values()].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  const derivedPaid = ledger.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);
  const derivedPending = ledger.filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.amount, 0);
  const cachedPaid = typeof source.lifetimePaid === 'number' && Number.isFinite(source.lifetimePaid)
    ? Math.max(0, source.lifetimePaid)
    : null;
  return {
    ledger,
    // Paid history may legitimately outlive pruned ledger rows. Pending cache is
    // not payout proof: only a currently retained pending row is payable.
    lifetimePaid: Math.max(cachedPaid ?? (ledger.length ? 0 : fresh.lifetimePaid), derivedPaid),
    lifetimePending: derivedPending,
  };
}

function normalizeMemoryShape(raw: unknown): WriterMemory | null {
  if (!isRecord(raw)) return null;
  const defaults = emptyMemory();
  const masterySource = isRecord(raw.mastery) ? raw.mastery : {};
  const mastery = {} as JudgeBreakdown;
  for (const dimension of DIMS) mastery[dimension] = Math.max(0, Math.min(10, finite(masterySource[dimension], 0)));
  const piecesSource = isRecord(raw.piecesByMode) ? raw.piecesByMode : {};
  const piecesByMode = {
    scene: counter(piecesSource.scene),
    story: counter(piecesSource.story),
    mystery: counter(piecesSource.mystery),
    upgrade: counter(piecesSource.upgrade),
  };
  const dimensionOrNull = (value: unknown): keyof JudgeBreakdown | null =>
    DIMS.includes(value as keyof JudgeBreakdown) ? (value as keyof JudgeBreakdown) : null;
  const targets: WriterMemory['growthTargetByMode'] = {};
  if (isRecord(raw.growthTargetByMode)) {
    for (const mode of MODES) {
      const dimension = dimensionOrNull(raw.growthTargetByMode[mode]);
      if (dimension) targets[mode] = dimension;
    }
  }
  let lastGrowth: WriterMemory['lastGrowth'] = null;
  if (isRecord(raw.lastGrowth)) {
    const dimension = dimensionOrNull(raw.lastGrowth.dimension);
    if (dimension) {
      lastGrowth = {
        dimension,
        improved: raw.lastGrowth.improved === true,
        mode: modeValue(raw.lastGrowth.mode),
      };
    }
  }
  return {
    ...defaults,
    mastery,
    sampleCount: counter(raw.sampleCount),
    piecesByMode,
    strength: dimensionOrNull(raw.strength),
    growthEdge: dimensionOrNull(raw.growthEdge),
    growthTargetByMode: targets,
    lastGrowth,
    vocabularyVault: stringArray(raw.vocabularyVault).slice(0, 200),
    recentlyShownSkills: stringArray(raw.recentlyShownSkills).slice(0, 20),
    lastSkillSource: raw.lastSkillSource === 'classic' || raw.lastSkillSource === 'contemporary' ? raw.lastSkillSource : null,
    bestScore: Math.max(0, Math.min(100, finite(raw.bestScore, 0))),
    updatedAt: Math.max(0, finite(raw.updatedAt, 0)),
  };
}

function memoryExtrema(mastery: JudgeBreakdown): { strength: keyof JudgeBreakdown; growthEdge: keyof JudgeBreakdown } {
  let strength = DIMS[0];
  let growthEdge = DIMS[0];
  for (const dimension of DIMS) {
    if (mastery[dimension] > mastery[strength]) strength = dimension;
    if (mastery[dimension] < mastery[growthEdge]) growthEdge = dimension;
  }
  return { strength, growthEdge };
}

function crediblePrunedMemory(raw: unknown, saved: WriterMemory, entries: Entry[], rebuilt: WriterMemory): boolean {
  if (!isRecord(raw) || !isRecord(raw.mastery) || !isRecord(raw.piecesByMode)) return false;
  const rawMastery = raw.mastery;
  const rawPiecesByMode = raw.piecesByMode;
  if (typeof raw.sampleCount !== 'number' || !Number.isInteger(raw.sampleCount) || raw.sampleCount <= rebuilt.sampleCount) return false;
  if (entries.length < LEGACY_ENTRY_CAP || rebuilt.sampleCount === 0) return false;
  if (!DIMS.every((dimension) => {
    const value = rawMastery[dimension];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
  })) return false;
  if (!MODES.every((mode) => {
    const value = rawPiecesByMode[mode];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  })) return false;
  if (MODES.reduce((sum, mode) => sum + saved.piecesByMode[mode], 0) !== saved.sampleCount) return false;

  const retainedCounts = { scene: 0, story: 0, mystery: 0, upgrade: 0 } satisfies Record<Mode, number>;
  const retained = entriesWithLatestValidGrading(entries);
  for (const entry of retained) retainedCounts[entry.mode] += 1;
  if (MODES.some((mode) => saved.piecesByMode[mode] < retainedCounts[mode])) return false;
  const retainedBest = retained.reduce((best, entry) => Math.max(best, entry.judge.score), 0);
  const retainedLatest = retained.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0);
  if (saved.bestScore < retainedBest || saved.updatedAt < retainedLatest || saved.updatedAt <= 0) return false;
  if (DIMS.some((dimension) => retained.some((entry) => entry.judge.breakdown[dimension] > 0) && saved.mastery[dimension] === 0)) return false;

  const extrema = memoryExtrema(saved.mastery);
  return saved.strength === extrema.strength && saved.growthEdge === extrema.growthEdge;
}

export function reconcileMemory(entries: Entry[], rawMemory: unknown): WriterMemory {
  const saved = normalizeMemoryShape(rawMemory);
  const rebuilt = buildMemory(entries);
  // Only a complete aggregate backed by the historical 500-entry cap can stand
  // in for pruned rows. A large sampleCount by itself is not provenance.
  const core = saved && crediblePrunedMemory(rawMemory, saved, entries, rebuilt) ? saved : rebuilt;
  return {
    ...core,
    recentlyShownSkills: saved?.recentlyShownSkills ?? [],
    lastSkillSource: saved?.lastSkillSource ?? null,
  };
}

function normalizeCraft(raw: unknown): CraftState {
  const source = isRecord(raw) ? raw : {};
  return {
    practicedSkills: sortedStringArray(source.practicedSkills),
    masteredSkills: sortedStringArray(source.masteredSkills),
  };
}

function normalizeSettings(raw: unknown, fresh: Settings): Settings {
  const source = isRecord(raw) ? raw : {};
  return {
    parentPinHash: typeof source.parentPinHash === 'string' ? source.parentPinHash : fresh.parentPinHash,
    parentPinSalt: stringValue(source.parentPinSalt, fresh.parentPinSalt),
    geminiApiKey: typeof source.geminiApiKey === 'string' ? source.geminiApiKey : fresh.geminiApiKey,
    geminiModel: stringValue(source.geminiModel, fresh.geminiModel),
    dailyCapDollars: Math.max(0, finite(source.dailyCapDollars, fresh.dailyCapDollars)),
    capBehavior: source.capBehavior === 'lock' ? 'lock' : source.capBehavior === 'forfeit' ? 'forfeit' : fresh.capBehavior,
    audienceAge: counter(source.audienceAge, fresh.audienceAge),
  };
}

function normalizeBaseline(raw: unknown, fallback: ProgressBaseline): ProgressBaseline {
  const source = isRecord(raw) ? raw : {};
  const provenances: ProgressBaseline['provenance'][] = ['fresh', 'legacy-local', 'cloud', 'import', 'reconciled'];
  return {
    id: nonBlankString(source.id, fallback.id),
    createdAt: timestamp(source.createdAt, fallback.createdAt),
    provenance: provenances.includes(source.provenance as ProgressBaseline['provenance'])
      ? (source.provenance as ProgressBaseline['provenance'])
      : fallback.provenance,
    fingerprint: nonBlankString(source.fingerprint, fallback.fingerprint),
    xp: nonnegative(source.xp, fallback.xp),
    totalWords: counter(source.totalWords, fallback.totalWords),
    totalChallenges: counter(source.totalChallenges, fallback.totalChallenges),
  };
}

function normalizeOperation(raw: unknown, fallbackBaselineId: string, index: number): ProgressOperation | null {
  if (!isRecord(raw)) return null;
  const kind = raw.kind === 'entry-revision' ? 'entry-revision' : raw.kind === 'entry-submit' ? 'entry-submit' : null;
  const entryId = stringValue(raw.entryId).trim();
  const versionId = stringValue(raw.versionId).trim();
  if (!kind || !entryId || !versionId) return null;
  return {
    id: nonBlankString(raw.id, `recovered-operation-${index}-${stableId({ raw, index })}`),
    baselineId: nonBlankString(raw.baselineId, fallbackBaselineId),
    kind,
    entryId,
    versionId,
    createdAt: timestamp(raw.createdAt, deterministicTimestamp({ kind: 'operation', raw, index })),
    xpDelta: nonnegative(raw.xpDelta),
    totalWordsDelta: counter(raw.totalWordsDelta),
    totalChallengesDelta: counter(raw.totalChallengesDelta),
  };
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Maximum score proven by a current entry or one of its immutable versions. */
export function maxHistoricalScore(entries: Entry[]): number {
  return entries.reduce((highest, entry) => {
    const currentScore = hasValidGrading(entry) ? entry.judge.score : 0;
    const versionScore = (entry.versions ?? [])
      .filter((version) => version.kind !== 'conflict' && hasValidGrading(version))
      .reduce((max, version) => Math.max(max, version.judge.score), 0);
    return Math.max(highest, currentScore, versionScore);
  }, 0);
}

function fallbackProgress(
  writer: WriterState,
  entries: Entry[],
  provenance: ProgressBaseline['provenance'],
  seed: unknown,
): ProgressHistory {
  const counters = {
    xp: writer.xp,
    totalWords: writer.totalWords,
    totalChallenges: writer.totalChallenges,
  };
  const entryIds = entries.map((entry) => entry.id);
  const fingerprint = baselineFingerprint(counters, entryIds);
  const createdAt = entries.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0)
    || deterministicTimestamp({ kind: 'progress', seed });
  const identitySeed = { counters, entryIds: [...entryIds].sort(), provenance, seed };
  return {
    lineageId: deterministicUuid({ kind: 'lineage', identitySeed }),
    generation: deterministicUuid({ kind: 'generation', identitySeed }),
    baseline: {
      id: `baseline-${fingerprint}-${stableId(identitySeed)}`,
      createdAt,
      provenance,
      fingerprint,
      ...counters,
    },
    baselineConflicts: [],
    operations: [],
    updatedAt: createdAt,
  };
}

function dedupeOperations(operations: ProgressOperation[], entries: Entry[], baselineId: string): ProgressOperation[] {
  const groups = new Map<string, { canonical: ProgressOperation[]; conflicts: ProgressOperation[] }>();
  for (const operation of operations) {
    const conflictAt = operation.id.indexOf('~conflict-');
    const rootId = conflictAt >= 0 ? operation.id.slice(0, conflictAt) : operation.id;
    const group = groups.get(rootId) ?? { canonical: [], conflicts: [] };
    (conflictAt >= 0 || operation.baselineId.startsWith('conflict:') ? group.conflicts : group.canonical).push(operation);
    groups.set(rootId, group);
  }
  const rows = new Map<string, ProgressOperation>();
  for (const [rootId, group] of groups) {
    const candidates = [...new Map(group.canonical.map((operation) => [stableStringify({ ...operation, id: rootId }), operation])).values()]
      .sort((left, right) => {
        const leftValid = left.baselineId === baselineId && operationMatchesRewardFacts({ ...left, id: rootId }, entries);
        const rightValid = right.baselineId === baselineId && operationMatchesRewardFacts({ ...right, id: rootId }, entries);
        if (leftValid !== rightValid) return leftValid ? -1 : 1;
        return stableStringify({ ...left, id: rootId }).localeCompare(stableStringify({ ...right, id: rootId }));
      });
    const winner = candidates.shift();
    if (winner) rows.set(rootId, { ...winner, id: rootId });
    for (const losing of candidates) {
      const conflictId = `${rootId}~conflict-${stableId({ ...losing, id: rootId })}`;
      rows.set(conflictId, { ...losing, id: conflictId, baselineId: `conflict:${losing.baselineId}` });
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
      const current = rows.get(conflictId);
      rows.set(conflictId, current && stableStringify(current) <= stableStringify(row) ? current : row);
    }
  }
  return [...rows.values()].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function normalizeProgress(raw: unknown, writer: WriterState, entries: Entry[], provenance: ProgressBaseline['provenance']): ProgressHistory {
  const source = isRecord(raw) ? raw : null;
  const fallback = fallbackProgress(writer, entries, provenance, raw ?? { writer, entries: entries.map((entry) => entry.id) });
  if (!source) return fallback;
  const baseline = normalizeBaseline(source.baseline, fallback.baseline);
  const operations = Array.isArray(source.operations)
    ? source.operations.map((operation, index) => normalizeOperation(operation, baseline.id, index)).filter((operation): operation is ProgressOperation => !!operation)
    : [];
  const uniqueOperations = dedupeOperations(operations, entries, baseline.id);
  const conflicts = Array.isArray(source.baselineConflicts)
    ? source.baselineConflicts.map((item) => normalizeBaseline(item, fallback.baseline))
    : [];
  return {
    lineageId: validUuid(source.lineageId) ? source.lineageId.toLowerCase() : deterministicUuid({ kind: 'lineage', source, fallback }),
    generation: validUuid(source.generation) ? source.generation.toLowerCase() : deterministicUuid({ kind: 'generation', source, fallback }),
    baseline,
    baselineConflicts: [...new Map(conflicts
      .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
      .map((item) => [item.id, item])).values()]
      .filter((item) => item.id !== baseline.id)
      .sort((left, right) => left.id.localeCompare(right.id)),
    operations: uniqueOperations,
    updatedAt: timestamp(source.updatedAt, fallback.updatedAt),
  };
}

export function applyRevisionPolicy(entries: Entry[], progress: ProgressHistory): Entry[] {
  const accepted = acceptedRevisionVersionIds(progress, entries);
  const entriesWithRevisionOperations = new Set(
    progress.operations
      .filter((operation) => operation.kind === 'entry-revision' && operation.baselineId === progress.baseline.id)
      .map((operation) => operation.entryId),
  );
  return entries.map((entry) => {
    const creditedCount = progress.operations.filter((operation) =>
      operation.kind === 'entry-revision'
      && operation.entryId === entry.id
      && accepted.has(operation.versionId)
    ).length;
    return {
      ...entry,
      revisionCount: entriesWithRevisionOperations.has(entry.id)
        ? Math.min(2, creditedCount)
        : Math.min(2, entry.revisionCount ?? 0),
    };
  });
}

export type NormalizationSource = 'local' | 'cloud' | 'import';

function rekeyEntry(entry: Entry, id: string): Entry {
  const versionIds = new Map<string, string>();
  const versions = (entry.versions ?? []).map((version) => {
    const nextId = `${version.id}~entry-${stableId({ id, version })}`;
    versionIds.set(version.id, nextId);
    return { ...version, id: nextId, entryId: id, kind: 'conflict' as const };
  });
  return {
    ...entry,
    id,
    versions: versions.map((version) => ({
      ...version,
      parentVersionId: version.parentVersionId ? versionIds.get(version.parentVersionId) ?? version.parentVersionId : null,
    })),
    currentVersionId: entry.currentVersionId ? versionIds.get(entry.currentVersionId) ?? entry.currentVersionId : undefined,
    firstDraft: entry.firstDraft
      ? { ...entry.firstDraft, versionId: versionIds.get(entry.firstDraft.versionId) ?? entry.firstDraft.versionId }
      : undefined,
  };
}

function canonicalEntries(entries: Entry[]): Entry[] {
  const rows = new Map<string, Entry>();
  for (const entry of entries.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))) {
    const current = rows.get(entry.id);
    if (!current) {
      rows.set(entry.id, entry);
      continue;
    }
    if (stableStringify(current) === stableStringify(entry)) continue;
    const conflictId = `${entry.id}~conflict-${stableId(entry)}`;
    rows.set(conflictId, rekeyEntry(entry, conflictId));
  }

  const uniqueEntries = [...rows.values()];
  const versionOwners = new Map<string, { entryId: string; version: EntryVersion }[]>();
  for (const entry of uniqueEntries) {
    for (const version of entry.versions ?? []) {
      const owners = versionOwners.get(version.id) ?? [];
      owners.push({ entryId: entry.id, version });
      versionOwners.set(version.id, owners);
    }
  }
  for (const [versionId, owners] of versionOwners) {
    if (owners.length < 2) continue;
    owners.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
    const winner = owners[0];
    for (const losing of owners.slice(1)) {
      const entry = rows.get(losing.entryId);
      if (!entry) continue;
      const replacementId = `${versionId}~conflict-${stableId(losing)}`;
      rows.set(entry.id, {
        ...entry,
        versions: (entry.versions ?? []).map((version) => version === losing.version
          ? { ...version, id: replacementId, kind: 'conflict' }
          : version),
        currentVersionId: entry.currentVersionId === versionId ? replacementId : entry.currentVersionId,
        firstDraft: entry.firstDraft?.versionId === versionId
          ? { ...entry.firstDraft, versionId: replacementId }
          : entry.firstDraft,
      });
    }
    void winner;
  }
  return [...rows.values()].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

export function assertSupportedSchema(raw: unknown): void {
  if (!isRecord(raw)) throw new Error('Saved data is not an object.');
  if (typeof raw.version === 'number' && Number.isFinite(raw.version) && raw.version > CURRENT_VERSION) {
    throw new UnsupportedSchemaVersionError(raw.version);
  }
}

/** Tolerant field-by-field normalization: one damaged entry never discards its neighbors or text. */
export function normalizeAppState(raw: unknown, source: NormalizationSource = 'local'): AppState {
  assertSupportedSchema(raw);
  if (!isRecord(raw)) throw new Error('Saved data is not an object.');
  const fresh = makeInitialState();
  let entries = canonicalEntries(Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry) : []);
  let writer = normalizeWriter(raw.writer, fresh.writer);
  const progressProvenance: ProgressBaseline['provenance'] = source === 'cloud' ? 'cloud' : source === 'import' ? 'import' : 'legacy-local';
  const progress = normalizeProgress(raw.progress, writer, entries, progressProvenance);
  entries = applyRevisionPolicy(entries, progress);
  const totals = operationTotals(progress, entries);
  const historicalMax = maxHistoricalScore(entries);
  const hasIncompleteGrades = entries.some((entry) => !hasValidGrading(entry));
  writer = {
    ...writer,
    ...totals,
    maxScore: entries.length === 0
      ? writer.maxScore
      : hasIncompleteGrades
        ? historicalMax
        : Math.max(writer.maxScore, historicalMax),
  };
  return {
    ...fresh,
    version: 4,
    writer,
    earnings: normalizeEarnings(raw.earnings, fresh.earnings),
    entries,
    memory: reconcileMemory(entries, raw.memory),
    craft: normalizeCraft(raw.craft),
    settings: normalizeSettings(raw.settings, fresh.settings),
    progress,
    screen: 'home',
    navStack: [],
    currentMode: null,
    currentChallengeId: null,
    lastJudge: null,
    lastEntryId: null,
    revisingEntryId: null,
    parentUnlockedUntil: 0,
    parentGateTarget: null,
  };
}

export function hasMeaningfulProgress(state: Pick<AppState, 'writer' | 'earnings' | 'entries' | 'craft'>): boolean {
  return (
    state.entries.length > 0 ||
    state.earnings.ledger.length > 0 ||
    state.writer.xp > 0 ||
    state.writer.totalWords > 0 ||
    state.writer.totalChallenges > 0 ||
    state.writer.achievements.length > 0 ||
    state.craft.practicedSkills.length > 0 ||
    state.craft.masteredSkills.length > 0
  );
}

export function makeFirstDraftVersion(entry: Entry, xpAwarded: number): EntryVersion {
  const versionId = `draft-${entry.id}`;
  return {
    id: versionId,
    entryId: entry.id,
    parentVersionId: null,
    revision: 0,
    kind: 'first-draft',
    createdAt: entry.createdAt,
    text: entry.text,
    wordCount: entry.wordCount,
    judge: entry.judge,
    gradingComplete: true,
    xpDelta: xpAwarded,
  };
}

export function ensureEntryVersions(entry: Entry): EntryVersion[] {
  if (entry.versions?.length) return dedupeVersions(entry.versions.map((version, index) => normalizeVersion(version, entry.id, entry, index)));
  return normalizeEntry(entry).versions ?? [];
}

export function makeRevisionVersion(
  entry: Entry,
  revisionId: string,
  createdAt: number,
  text: string,
  wordCount: number,
  judge: JudgeResult,
): EntryVersion {
  return {
    id: revisionId,
    entryId: entry.id,
    parentVersionId: entry.currentVersionId ?? ensureEntryVersions(entry).at(-1)?.id ?? null,
    revision: (entry.revisionCount ?? 0) + 1,
    kind: 'revision',
    createdAt,
    text,
    wordCount,
    judge,
    gradingComplete: true,
    xpDelta: 8,
  };
}

export { xpForFirstDraft };
