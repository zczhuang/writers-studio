import assert from 'node:assert/strict';
import test from 'node:test';

import { reducer } from '../src/state/reducer.ts';
import { makeInitialState, STORAGE_KEY } from '../src/state/initialState.ts';
import {
  RAW_RECOVERY_PREFIX,
  RAW_RECOVERY_FIRST_KEY,
  RAW_RECOVERY_LATEST_KEY,
  allowPersistenceWrites,
  getLocalPersistenceHealth,
  hydrate,
  persist,
  persistenceWritesAreBlocked,
} from '../src/state/persistence.ts';
import {
  createExportBundle,
  mergeAppStates,
  parseImportBundle,
  toCloudPayload,
} from '../src/cloud/model.ts';
import {
  CLOUD_ARCHIVE_KEY,
  CLOUD_META_KEY,
  archiveAndDetachCloudMeta,
  archiveCloudMetaBeforeNewLineage,
  generateRecoveryCode,
  isRecoveryCode,
  readCloudMeta,
  writeCloudMeta,
} from '../src/cloud/recovery.ts';
import { stableStringify } from '../src/utils/stable.ts';
import { normalizeAppState } from '../src/state/normalization.ts';
import { averageBreakdown, buildMemory, dimensionSeries } from '../src/services/writerMemory.ts';
import { gradingPresentation } from '../src/services/gradingPresentation.ts';
import { BADGES } from '../src/data/badges.ts';
import { badgeProgress } from '../src/utils/progression.ts';

const NOW = new Date(2026, 9, 3, 12, 0, 0).getTime();

function makeJudge(score = 80, tier = 'gold') {
  return {
    score,
    tier,
    breakdown: { vocabulary: 7, imagery: 8, voice: 7, structure: 7, originality: 8 },
    strengths: ['Clear detail.'],
    suggestions: ['Try one more image.'],
    celebrate: 'A vivid page',
    source: 'heuristic',
  };
}

function entry(id, text = `Writing for ${id}`, wordCount = 10) {
  return {
    id,
    date: '2026-10-03',
    createdAt: NOW,
    mode: 'scene',
    challengeId: 'sc1',
    challengeTitle: 'A recovered page',
    prompt: 'Write a page.',
    text,
    wordCount,
    judge: makeJudge(),
    earningsId: `ledger-${id}`,
    revisionCount: 0,
  };
}

function ledger(id, overrides = {}) {
  return {
    id: `ledger-${id}`,
    entryId: id,
    amount: 0.5,
    tier: 'gold',
    status: 'pending',
    createdAt: NOW,
    ...overrides,
  };
}

function submit(state, id, text = `Writing for ${id}`, wordCount = 10) {
  return reducer(state, { type: 'SUBMIT_ENTRY', entry: entry(id, text, wordCount), ledger: ledger(id) });
}

function revise(state, entryId, versionId, text, occurredAt) {
  return reducer(state, {
    type: 'REVISE_ENTRY',
    entryId,
    text,
    wordCount: text.split(/\s+/).length,
    judge: makeJudge(88, 'gold'),
    ledgerPatch: { amount: 999, tier: 'none', status: 'paid' },
    revisionVersionId: versionId,
    occurredAt,
  });
}

class MemoryStorage {
  #values = new Map();
  #failedKeys = new Set();
  #ignoredKeys = new Set();
  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key) { this.#values.delete(key); }
  setItem(key, value) {
    if (this.#failedKeys.has(key)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    if (!this.#ignoredKeys.has(key)) this.#values.set(key, String(value));
  }
  entries() { return [...this.#values.entries()]; }
  failKey(key) { this.#failedKeys.add(key); }
  allowKey(key) { this.#failedKeys.delete(key); }
  ignoreKey(key) { this.#ignoredKeys.add(key); }
  respectKey(key) { this.#ignoredKeys.delete(key); }
}

function withStorage(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  allowPersistenceWrites();
  t.after(() => {
    allowPersistenceWrites();
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  return storage;
}

test('malformed legacy grading preserves raw JSON, text, totals, settings, and valid coaching memory', (t) => {
  const storage = withStorage(t);
  const fresh = makeInitialState();
  const valid = entry('valid', 'Glittering thunderclouds crowded the restless shoreline.', 8);
  const malformed = {
    id: 'malformed',
    date: '2026-10-02',
    createdAt: NOW - 1000,
    mode: 'story',
    challengeId: 'st1',
    challengeTitle: 'Saved words',
    prompt: 'Keep this.',
    text: 'This recoverable sentence must never disappear.',
    wordCount: 7,
    earningsId: 'ledger-malformed',
  };
  const source = {
    version: 2,
    writer: { ...fresh.writer, name: 'Leeann', xp: 777, totalWords: 1234, totalChallenges: 19 },
    earnings: { ledger: [ledger('valid', { status: 'paid', paidAt: NOW })], lifetimePaid: 0.5, lifetimePending: 0 },
    entries: [malformed, valid],
    settings: { ...fresh.settings, parentPinHash: 'keep-pin', parentPinSalt: 'keep-salt', dailyCapDollars: 2.75 },
  };
  const raw = JSON.stringify(source);
  storage.setItem(STORAGE_KEY, raw);

  const result = hydrate();
  const rawBackups = storage.entries().filter(([key]) => key.startsWith(RAW_RECOVERY_PREFIX));

  assert.equal(rawBackups.length, 1);
  assert.equal(rawBackups[0][1], raw);
  assert.equal(result.writer.xp, 777);
  assert.equal(result.writer.totalWords, 1234);
  assert.equal(result.writer.totalChallenges, 19);
  assert.equal(result.settings.parentPinHash, 'keep-pin');
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].text, malformed.text);
  assert.equal(result.entries[0].gradingComplete, false);
  assert.equal(result.entries[0].judge.score, 0);
  assert.equal(result.memory.sampleCount, 1);
  assert.equal(result.memory.bestScore, valid.judge.score);
  assert.equal(persist(result), true);
});

test('unparseable source is never overwritten by mount-style persistence', (t) => {
  const storage = withStorage(t);
  const raw = '{"version":2,"entries":[';
  storage.setItem(STORAGE_KEY, raw);

  const fallback = hydrate();
  assert.equal(persistenceWritesAreBlocked(), true);
  assert.equal(persist(fallback), false);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.entries().some(([key, value]) => key.startsWith(RAW_RECOVERY_PREFIX) && value === raw), true);
});

test('v3 stale memory and unversioned exports rebuild safely while preserving rotation and craft', (t) => {
  const storage = withStorage(t);
  const fresh = makeInitialState();
  const saved = {
    writer: { ...fresh.writer, xp: 91, totalWords: 13, totalChallenges: 1 },
    earnings: fresh.earnings,
    entries: [entry('one', 'A phosphorescent river curled beneath the bridge.', 8)],
    memory: { sampleCount: 0, recentlyShownSkills: ['imagery-zoom'], lastSkillSource: 'classic' },
    craft: { practicedSkills: ['imagery-zoom'], masteredSkills: ['imagery-zoom'] },
    settings: fresh.settings,
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const result = hydrate();

  assert.equal(result.version, 4);
  assert.equal(result.memory.sampleCount, 1);
  assert.deepEqual(result.memory.recentlyShownSkills, ['imagery-zoom']);
  assert.equal(result.memory.lastSkillSource, 'classic');
  assert.deepEqual(result.craft, saved.craft);
  assert.equal(result.writer.xp, 91);
  assert.equal(result.progress.baseline.xp, 91);
});

test('fractional legacy and earned XP survives every normalizer and backup round-trip exactly', () => {
  const fresh = makeInitialState();
  const legacy = normalizeAppState({
    version: 3,
    writer: { ...fresh.writer, xp: 345.4, totalWords: 12, totalChallenges: 1 },
    entries: [entry('fractional-legacy', 'Legacy totals keep every decimal.', 12)],
  });
  assert.equal(legacy.writer.xp, 345.4);
  assert.equal(legacy.progress.baseline.xp, 345.4);
  assert.equal(parseImportBundle(JSON.stringify(createExportBundle(legacy))).writer.xp, 345.4);

  const earned = submit(makeInitialState(), 'fractional-earned');
  const expectedXp = 92.2;
  earned.entries[0].judge.breakdown.imagery = 8.1;
  earned.entries[0].versions[0].judge.breakdown.imagery = 8.1;
  earned.entries[0].versions[0].xpDelta = expectedXp;
  earned.entries[0].firstDraft.xpAwarded = expectedXp;
  earned.progress.operations[0].xpDelta = expectedXp;
  earned.writer.xp = expectedXp;
  const normalized = normalizeAppState(toCloudPayload(earned), 'cloud');
  assert.equal(normalized.writer.xp, expectedXp);
  assert.equal(normalized.entries[0].versions[0].xpDelta, expectedXp);
  assert.equal(normalized.entries[0].firstDraft.xpAwarded, expectedXp);
  assert.equal(normalized.progress.operations[0].xpDelta, expectedXp);
  const repeated = parseImportBundle(JSON.stringify(createExportBundle(normalized)));
  assert.equal(stableStringify(toCloudPayload(repeated)), stableStringify(toCloudPayload(normalized)));
});

test('canonicalizes only progress UUID casing across cloud payload and import round-trip', () => {
  const payload = toCloudPayload(submit(makeInitialState(), 'Mixed-Entry-ID'));
  const entryRow = payload.entries[0];
  const version = entryRow.versions[0];
  const operation = payload.progress.operations[0];
  const entryId = 'MiXeD-Entry-ID';
  const versionId = 'MiXeD-Version-ID';
  const baselineId = 'MiXeD-Baseline-ID';
  const ledgerId = 'MiXeD-Ledger-ID';
  const lineageId = 'AABBCCDD-EEFF-4A11-8B22-CCDDEEFF0011';
  const generation = '11223344-5566-4A77-9B88-AABBCCDDEEFF';

  entryRow.id = entryId;
  entryRow.earningsId = ledgerId;
  entryRow.currentVersionId = versionId;
  entryRow.firstDraft.versionId = versionId;
  version.id = versionId;
  version.entryId = entryId;
  payload.earnings.ledger[0].id = ledgerId;
  payload.earnings.ledger[0].entryId = entryId;
  payload.progress.baseline.id = baselineId;
  operation.id = `submit:${entryId}`;
  operation.baselineId = baselineId;
  operation.entryId = entryId;
  operation.versionId = versionId;
  payload.progress.lineageId = lineageId;
  payload.progress.generation = generation;

  const normalized = normalizeAppState(payload, 'cloud');
  assert.equal(normalized.progress.lineageId, lineageId.toLowerCase());
  assert.equal(normalized.progress.generation, generation.toLowerCase());
  assert.equal(normalized.entries[0].id, entryId);
  assert.equal(normalized.entries[0].versions[0].id, versionId);
  assert.equal(normalized.entries[0].earningsId, ledgerId);
  assert.equal(normalized.earnings.ledger[0].id, ledgerId);
  assert.equal(normalized.progress.baseline.id, baselineId);
  assert.equal(normalized.progress.operations[0].id, `submit:${entryId}`);

  const bundle = createExportBundle(normalized);
  assert.equal(bundle.recovery.lineageId, lineageId.toLowerCase());
  assert.equal(bundle.recovery.generation, generation.toLowerCase());
  const roundTrip = parseImportBundle(JSON.stringify(bundle));
  assert.equal(roundTrip.progress.lineageId, lineageId.toLowerCase());
  assert.equal(roundTrip.progress.generation, generation.toLowerCase());
  assert.equal(roundTrip.entries[0].id, entryId);
  assert.equal(roundTrip.entries[0].versions[0].id, versionId);
  assert.equal(roundTrip.progress.baseline.id, baselineId);
  assert.equal(roundTrip.progress.operations[0].id, `submit:${entryId}`);
});

test('cloud/export serialization is an allowlist with history and without any device secrets', () => {
  let state = submit(makeInitialState(), 'secret-test', 'A long enough secret-free writing sample.', 8);
  state = {
    ...state,
    screen: 'settings',
    navStack: ['home'],
    currentChallengeId: 'NAV_SENTINEL_942',
    parentUnlockedUntil: 9999999999999,
    settings: {
      ...state.settings,
      geminiApiKey: 'GEMINI_SECRET_SENTINEL_942',
      parentPinHash: 'PIN_HASH_SENTINEL_942',
      parentPinSalt: 'PIN_SALT_SENTINEL_942',
    },
  };
  const payloadText = JSON.stringify(toCloudPayload(state));
  const exportText = JSON.stringify(createExportBundle(state));
  for (const secret of ['GEMINI_SECRET_SENTINEL_942', 'PIN_HASH_SENTINEL_942', 'PIN_SALT_SENTINEL_942', 'NAV_SENTINEL_942']) {
    assert.equal(payloadText.includes(secret), false);
    assert.equal(exportText.includes(secret), false);
  }
  for (const key of ['parentUnlockedUntil', 'parentPinHash', 'parentPinSalt', 'geminiApiKey', 'navStack', 'currentChallengeId']) {
    assert.equal(payloadText.includes(`"${key}"`), false);
  }
  assert.equal(payloadText.includes('firstDraft'), true);
  assert.equal(payloadText.includes('operations'), true);
  assert.equal(exportText.includes('writing history, not the private cloud recovery code'), true);
});

test('two devices union unique operations exactly once without summing the shared legacy baseline', () => {
  const baseline = makeInitialState();
  baseline.writer = { ...baseline.writer, xp: 400, totalWords: 900, totalChallenges: 12 };
  baseline.progress.baseline = {
    ...baseline.progress.baseline,
    xp: 400,
    totalWords: 900,
    totalChallenges: 12,
  };
  const left = submit(structuredClone(baseline), 'left', 'Left device added ten words today.', 10);
  const right = submit(structuredClone(baseline), 'right', 'Right device added twelve words today.', 12);
  const leftGain = left.writer.xp - 400;
  const rightGain = right.writer.xp - 400;

  const merged = mergeAppStates(left, right);
  assert.deepEqual(merged.entries.map((item) => item.id).sort(), ['left', 'right']);
  assert.equal(merged.writer.xp, 400 + leftGain + rightGain);
  assert.equal(merged.writer.totalWords, 922);
  assert.equal(merged.writer.totalChallenges, 14);
  assert.equal(merged.progress.operations.length, 2);
  assert.equal(merged.earnings.ledger.length, 2);

  const retried = mergeAppStates(merged, right);
  assert.equal(retried.writer.xp, merged.writer.xp);
  assert.equal(retried.writer.totalWords, merged.writer.totalWords);
  assert.equal(retried.progress.operations.length, 2);
  assert.equal(stableStringify(retried.entries), stableStringify(merged.entries));
});

test('ambiguous different legacy baselines are retained but never added together', () => {
  const left = makeInitialState();
  left.writer = { ...left.writer, xp: 100, totalWords: 500, totalChallenges: 5 };
  left.progress.baseline = { ...left.progress.baseline, xp: 100, totalWords: 500, totalChallenges: 5 };
  let right = makeInitialState();
  right.writer = { ...right.writer, xp: 200, totalWords: 800, totalChallenges: 8 };
  right.progress.baseline = { ...right.progress.baseline, xp: 200, totalWords: 800, totalChallenges: 8 };
  right = submit(right, 'foreign-lineage-entry', 'A separate legacy line stays visible.', 6);

  const merged = mergeAppStates(left, right);
  assert.equal(merged.writer.totalWords, 500);
  assert.equal(merged.writer.xp, 100);
  assert.equal(merged.progress.baselineConflicts.some((item) => item.id === right.progress.baseline.id), true);
  assert.equal(merged.progress.operations.some((operation) => operation.baselineId.startsWith('foreign:')), true);
});

test('paid and forfeited ledger rows are terminal during merges', () => {
  const base = submit(makeInitialState(), 'terminal');
  const paid = structuredClone(base);
  paid.earnings.ledger[0] = { ...paid.earnings.ledger[0], status: 'paid', paidAt: NOW, paidNote: 'Paid' };
  paid.earnings.lifetimePaid = paid.earnings.ledger[0].amount;
  paid.earnings.lifetimePending = 0;
  const stalePending = structuredClone(base);
  stalePending.earnings.ledger[0] = { ...stalePending.earnings.ledger[0], amount: 5, status: 'pending' };

  const paidMerged = mergeAppStates(stalePending, paid);
  assert.equal(paidMerged.earnings.ledger[0].status, 'paid');
  assert.equal(paidMerged.earnings.ledger[0].amount, paid.earnings.ledger[0].amount);

  const forfeited = structuredClone(base);
  forfeited.earnings.ledger[0] = { ...forfeited.earnings.ledger[0], status: 'forfeited', amount: 0 };
  const forfeitedMerged = mergeAppStates(stalePending, forfeited);
  assert.equal(forfeitedMerged.earnings.ledger[0].status, 'forfeited');
  assert.equal(forfeitedMerged.earnings.ledger[0].amount, 0);
});

test('settled rows cannot revive stale cached pending money or UI payout eligibility', () => {
  const base = submit(makeInitialState(), 'settled-cache');
  const paid = structuredClone(base);
  paid.earnings.ledger[0] = {
    ...paid.earnings.ledger[0], amount: 1, status: 'paid', paidAt: NOW + 10, paidNote: 'Settled once',
  };
  paid.earnings.lifetimePaid = 4.75; // includes legitimate paid history whose rows were pruned
  paid.earnings.lifetimePending = 0;
  const stale = structuredClone(base);
  stale.earnings.ledger[0] = { ...stale.earnings.ledger[0], amount: 1, status: 'pending' };
  stale.earnings.lifetimePending = 1;

  for (const merged of [mergeAppStates(paid, stale), mergeAppStates(stale, paid)]) {
    assert.equal(merged.earnings.ledger.filter((row) => row.status === 'pending').length, 0);
    assert.equal(merged.earnings.lifetimePending, 0);
    assert.equal(merged.earnings.lifetimePaid, 4.75);
    assert.equal(merged.earnings.ledger[0].status, 'paid');
    const repeated = mergeAppStates(merged, stale);
    assert.equal(stableStringify(toCloudPayload(repeated)), stableStringify(toCloudPayload(merged)));
    const roundTrip = parseImportBundle(JSON.stringify(createExportBundle(merged)));
    assert.equal(roundTrip.earnings.lifetimePending, 0);
    assert.equal(roundTrip.earnings.ledger.some((row) => row.status === 'pending'), false);
  }
});

test('same-ID paid conflicts stay quarantined with their original evidence across repeats and merges', () => {
  const base = submit(makeInitialState(), 'paid-conflict');
  const first = {
    ...base.earnings.ledger[0], amount: 1, status: 'paid', paidAt: NOW + 10, paidNote: 'Cash envelope A',
  };
  const second = {
    ...base.earnings.ledger[0], amount: 1, status: 'paid', paidAt: NOW + 20, paidNote: 'Cash envelope B',
  };
  const raw = toCloudPayload(base);
  raw.earnings = { ledger: [first, second], lifetimePaid: 1, lifetimePending: 0 };
  const normalized = normalizeAppState(raw, 'cloud');
  assert.deepEqual(normalized.earnings.ledger.map((row) => row.status).sort(), ['forfeited', 'paid']);
  assert.deepEqual(normalized.earnings.ledger.map((row) => row.paidNote).sort(), ['Cash envelope A', 'Cash envelope B']);
  assert.equal(normalized.earnings.ledger.find((row) => row.status === 'forfeited').paidAt > 0, true);
  assert.equal(normalized.earnings.lifetimePaid, 1);

  const repeated = normalizeAppState(toCloudPayload(normalized), 'cloud');
  assert.equal(stableStringify(toCloudPayload(repeated)), stableStringify(toCloudPayload(normalized)));
  const roundTrip = parseImportBundle(JSON.stringify(createExportBundle(normalized)));
  assert.equal(stableStringify(toCloudPayload(roundTrip)), stableStringify(toCloudPayload(normalized)));

  const branchA = structuredClone(base);
  branchA.earnings = { ledger: [first], lifetimePaid: 1, lifetimePending: 0 };
  const branchB = structuredClone(base);
  branchB.earnings = { ledger: [second], lifetimePaid: 1, lifetimePending: 0 };
  const ab = mergeAppStates(branchA, branchB);
  const ba = mergeAppStates(branchB, branchA);
  assert.equal(stableStringify(toCloudPayload(ab)), stableStringify(toCloudPayload(ba)));
  assert.deepEqual(ab.earnings.ledger.map((row) => row.status).sort(), ['forfeited', 'paid']);
  assert.deepEqual(ab.earnings.ledger.map((row) => row.paidNote).sort(), ['Cash envelope A', 'Cash envelope B']);
  assert.equal(stableStringify(toCloudPayload(mergeAppStates(ab, branchB))), stableStringify(toCloudPayload(ab)));
});

test('new revisions retain the immutable first draft and unique progress delta', () => {
  const submitted = submit(makeInitialState(), 'revision', 'The original first draft stays here.', 7);
  const revised = reducer(submitted, {
    type: 'REVISE_ENTRY',
    entryId: 'revision',
    text: 'The revised draft adds silver rain and a ringing bell.',
    wordCount: 10,
    judge: makeJudge(90, 'gold'),
    ledgerPatch: { amount: 999, tier: 'none', status: 'paid' },
    revisionVersionId: 'revision-version-fixed',
    occurredAt: NOW + 1000,
  });

  assert.equal(revised.entries[0].versions.length, 2);
  assert.equal(revised.entries[0].versions[0].text, 'The original first draft stays here.');
  assert.equal(revised.entries[0].versions[0].kind, 'first-draft');
  assert.equal(revised.entries[0].versions[1].text, 'The revised draft adds silver rain and a ringing bell.');
  assert.equal(revised.entries[0].firstDraft.wordCount, 7);
  assert.equal(revised.progress.operations.filter((operation) => operation.kind === 'entry-revision').length, 1);
  assert.equal(revised.writer.xp, submitted.writer.xp + 8);
});

test('concurrent revisions of one stable entry retain both versions and dedupe the first draft', () => {
  const submitted = submit(makeInitialState(), 'shared-revision', 'The shared first draft.', 4);
  const left = reducer(structuredClone(submitted), {
    type: 'REVISE_ENTRY', entryId: 'shared-revision', text: 'Left revision with rain.', wordCount: 4,
    judge: makeJudge(84, 'gold'), ledgerPatch: { amount: 0, tier: 'none', status: 'paid' },
    revisionVersionId: 'left-version', occurredAt: NOW + 1000,
  });
  const right = reducer(structuredClone(submitted), {
    type: 'REVISE_ENTRY', entryId: 'shared-revision', text: 'Right revision with bells.', wordCount: 4,
    judge: makeJudge(86, 'gold'), ledgerPatch: { amount: 0, tier: 'none', status: 'paid' },
    revisionVersionId: 'right-version', occurredAt: NOW + 2000,
  });
  const merged = mergeAppStates(left, right);
  const versions = merged.entries[0].versions;

  assert.equal(versions.length, 3);
  assert.equal(versions.filter((version) => version.kind === 'first-draft').length, 1);
  assert.equal(versions.some((version) => version.text === 'Left revision with rain.'), true);
  assert.equal(versions.some((version) => version.text === 'Right revision with bells.'), true);
  assert.equal(merged.writer.xp, submitted.writer.xp + 16);
  assert.equal(merged.progress.operations.filter((operation) => operation.kind === 'entry-revision').length, 2);
});

test('journal history is no longer silently truncated after 500 entries', () => {
  let state = makeInitialState();
  for (let index = 0; index < 501; index += 1) state = submit(state, `entry-${index}`, `Writing number ${index}.`, 3);
  assert.equal(state.entries.length, 501);
  assert.equal(state.entries[0].id, 'entry-0');
  assert.equal(state.entries.at(-1).id, 'entry-500');
});

test('empty state never replaces nonempty history, while an empty browser can restore it', () => {
  const empty = makeInitialState();
  const cloud = submit(structuredClone(empty), 'cloud-entry');
  const restored = mergeAppStates(empty, cloud, true);
  assert.equal(restored.entries.length, 1);
  assert.equal(restored.writer.totalChallenges, 1);
  const protectedLocal = mergeAppStates(cloud, makeInitialState());
  assert.strictEqual(protectedLocal, cloud);
});

test('export import restores a blank device without secrets or reward replay', () => {
  const source = submit(makeInitialState(), 'exported', 'A page saved for another browser.', 7);
  const bundle = createExportBundle(source);
  const imported = parseImportBundle(JSON.stringify(bundle));
  const restored = mergeAppStates(makeInitialState(), imported, true);
  assert.equal(restored.entries.length, 1);
  assert.equal(restored.writer.xp, source.writer.xp);
  assert.equal(restored.writer.totalWords, source.writer.totalWords);
  assert.equal(restored.earnings.lifetimePending, source.earnings.lifetimePending);
});

test('recovery codes carry 256 bits and cannot be confused with a four-digit PIN', () => {
  const first = generateRecoveryCode();
  const second = generateRecoveryCode();
  assert.equal(first.length, 43);
  assert.equal(isRecoveryCode(first), true);
  assert.notEqual(first, second);
  assert.equal(isRecoveryCode('0717'), false);
  const bytes = Buffer.from(first.replace(/-/g, '+').replace(/_/g, '/') + '=', 'base64');
  assert.equal(bytes.length, 32);
});

test('reset rotates lineage and generation while leaving the old state object intact', () => {
  const prior = submit(makeInitialState(), 'before-reset');
  const next = reducer(prior, { type: 'RESET_ALL' });
  assert.notEqual(next.progress.lineageId, prior.progress.lineageId);
  assert.notEqual(next.progress.generation, prior.progress.generation);
  assert.equal(next.entries.length, 0);
  assert.equal(prior.entries.length, 1);
});

test('future schemas are rejected everywhere and local raw bytes remain write-protected', (t) => {
  const storage = withStorage(t);
  const future = { ...makeInitialState(), version: 99, futureOnly: { doNotLose: ['alpha', 7] } };
  const raw = JSON.stringify(future);
  storage.setItem(STORAGE_KEY, raw);

  const hydrated = hydrate();
  assert.equal(hydrated.entries.length, 0);
  assert.equal(getLocalPersistenceHealth().code, 'unsupported-version');
  assert.equal(persistenceWritesAreBlocked(), true);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(RAW_RECOVERY_FIRST_KEY), raw);
  assert.equal(persist(hydrated), false);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.throws(() => normalizeAppState(future, 'cloud'), /schema version 99/);
  assert.throws(() => parseImportBundle(JSON.stringify({ state: future })), /schema version 99/);
});

test('legacy checkpoint quota failure still shows healthy normalized data but blocks replacement', (t) => {
  const storage = withStorage(t);
  const source = {
    version: 2,
    writer: { ...makeInitialState().writer, xp: 123, totalWords: 10, totalChallenges: 1 },
    entries: [entry('visible', 'Healthy writing remains visible.', 10)],
  };
  const raw = JSON.stringify(source);
  storage.setItem(STORAGE_KEY, raw);
  storage.failKey(RAW_RECOVERY_FIRST_KEY);

  const hydrated = hydrate();
  assert.equal(hydrated.entries[0].text, 'Healthy writing remains visible.');
  assert.equal(hydrated.writer.xp, 123);
  assert.equal(getLocalPersistenceHealth().code, 'checkpoint-failed');
  assert.equal(persistenceWritesAreBlocked(), true);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(persist(hydrated), false);
});

test('raw recovery checkpoints are bounded and preserve the first byte-exact source', (t) => {
  const storage = withStorage(t);
  const firstRaw = JSON.stringify({ version: 2, writer: { name: 'First' }, entries: [] });
  const secondRaw = JSON.stringify({ version: 3, writer: { name: 'Second' }, entries: [entry('second')] });
  storage.setItem(STORAGE_KEY, firstRaw);
  hydrate();
  storage.setItem(STORAGE_KEY, secondRaw);
  hydrate();

  const recoveryRows = storage.entries().filter(([key]) => key.startsWith(RAW_RECOVERY_PREFIX));
  assert.equal(recoveryRows.length, 2);
  assert.equal(storage.getItem(RAW_RECOVERY_FIRST_KEY), firstRaw);
  assert.equal(storage.getItem(RAW_RECOVERY_LATEST_KEY), secondRaw);
});

test('valid current v4 hydration does not create a redundant migration checkpoint', (t) => {
  const storage = withStorage(t);
  const current = submit(makeInitialState(), 'current-v4');
  storage.setItem(STORAGE_KEY, JSON.stringify(current));
  const hydrated = hydrate();
  assert.equal(hydrated.entries[0].id, 'current-v4');
  assert.equal(storage.entries().filter(([key]) => key.startsWith(RAW_RECOVERY_PREFIX)).length, 0);
  assert.equal(getLocalPersistenceHealth().code, 'saved');
});

test('legacy missing identities and timestamps normalize deterministically without a clock', () => {
  const source = {
    version: 2,
    writer: {
      ...makeInitialState().writer,
      achievements: [{ id: '', unlockedAt: 0 }],
      activeQuests: [{ questId: '', completedSteps: ['b', 'a'], startedAt: 0 }],
    },
    entries: [
      { ...entry('', 'Dated legacy words.'), id: '', createdAt: 0, date: '2020-02-03', earningsId: '' },
      { ...entry('', 'Undated legacy words.'), id: ' ', createdAt: -1, date: '', earningsId: ' ' },
    ],
    earnings: { ledger: [{ ...ledger(''), id: '', entryId: '', createdAt: 0 }], lifetimePaid: 0, lifetimePending: 0.5 },
  };
  const first = normalizeAppState(source);
  const second = normalizeAppState(source);

  assert.deepEqual(first.entries.map(({ id, createdAt, earningsId, versions }) => ({ id, createdAt, earningsId, versions })),
    second.entries.map(({ id, createdAt, earningsId, versions }) => ({ id, createdAt, earningsId, versions })));
  assert.equal(first.entries.every((item) => item.createdAt > 0 && item.id.trim()), true);
  assert.equal(first.entries.find((item) => item.text.startsWith('Dated')).createdAt, Date.UTC(2020, 1, 3, 12));
  assert.deepEqual(first.earnings, second.earnings);
  assert.deepEqual(first.progress, second.progress);
  assert.deepEqual(first.writer.achievements, second.writer.achievements);
  assert.deepEqual(first.writer.activeQuests, second.writer.activeQuests);
});

test('partial inflated memory rebuilds, while a coherent old-cap aggregate is retained', () => {
  const one = entry('memory-one', 'A phosphorescent shoreline shimmered.', 5);
  const partial = normalizeAppState({
    version: 3,
    writer: { ...makeInitialState().writer, xp: 1, totalWords: 5, totalChallenges: 1 },
    entries: [one],
    memory: {
      sampleCount: 999,
      mastery: { vocabulary: 0, imagery: 0, voice: 0, structure: 0, originality: 0 },
      piecesByMode: { scene: 0, story: 0, mystery: 0, upgrade: 0 },
      strength: null,
      growthEdge: null,
      bestScore: 0,
      updatedAt: 0,
      recentlyShownSkills: ['imagery-zoom'],
      lastSkillSource: 'classic',
    },
  });
  assert.equal(partial.memory.sampleCount, 1);
  assert.equal(partial.memory.bestScore, one.judge.score);
  assert.deepEqual(partial.memory.recentlyShownSkills, ['imagery-zoom']);
  assert.equal(partial.memory.lastSkillSource, 'classic');

  const retained = Array.from({ length: 500 }, (_, index) => ({
    ...entry(`retained-${index}`, `Retained writing ${index}.`, 3),
    createdAt: NOW + index,
  }));
  const coherent = buildMemory(retained);
  coherent.sampleCount = 501;
  coherent.piecesByMode = { ...coherent.piecesByMode, scene: 501 };
  coherent.updatedAt += 1000;
  const restored = normalizeAppState({
    version: 3,
    writer: { ...makeInitialState().writer, xp: 500, totalWords: 1500, totalChallenges: 501 },
    entries: retained,
    memory: coherent,
  });
  assert.equal(restored.memory.sampleCount, 501);
  assert.deepEqual(restored.memory.mastery, coherent.mastery);
});

test('settlement evidence wins over stale status and unknown rows are never payable', () => {
  const normalized = normalizeAppState({
    version: 3,
    writer: makeInitialState().writer,
    earnings: {
      ledger: [
        { ...ledger('paid-at'), status: 'pending', paidAt: NOW },
        { ...ledger('paid-note'), status: 'mystery', paidNote: ' Cash paid ' },
        { ...ledger('quarantine'), status: 'mystery' },
        { ...ledger('payable'), status: 'pending' },
      ],
      lifetimePaid: 1,
      lifetimePending: 7,
    },
    entries: [],
  });
  const status = Object.fromEntries(normalized.earnings.ledger.map((row) => [row.entryId, row.status]));
  assert.equal(status['paid-at'], 'paid');
  assert.equal(status['paid-note'], 'paid');
  assert.equal(status.quarantine, 'forfeited');
  assert.equal(status.payable, 'pending');
  assert.deepEqual(normalized.earnings.ledger.filter((row) => row.status === 'pending').map((row) => row.entryId), ['payable']);
  assert.equal(normalized.earnings.lifetimePaid, 1);
  assert.equal(normalized.earnings.lifetimePending, 0.5);
});

test('reducer rejects blank and colliding identities before every reward mutation', () => {
  const initial = makeInitialState();
  const action = { type: 'SUBMIT_ENTRY', entry: entry('same'), ledger: ledger('same') };
  const submitted = reducer(initial, action);
  assert.strictEqual(reducer(submitted, action), submitted);
  assert.strictEqual(reducer(submitted, {
    type: 'SUBMIT_ENTRY', entry: entry('other'), ledger: { ...ledger('other'), id: 'ledger-same' },
  }), submitted);
  assert.strictEqual(reducer(submitted, {
    type: 'SUBMIT_ENTRY', entry: entry(' '), ledger: ledger('blank'),
  }), submitted);

  const revisionAction = {
    type: 'REVISE_ENTRY', entryId: 'same', text: 'A single accepted revision.', wordCount: 4,
    judge: makeJudge(88), ledgerPatch: { amount: 99, tier: 'none', status: 'paid' },
    revisionVersionId: 'stable-revision', occurredAt: NOW + 1,
  };
  const revised = reducer(submitted, revisionAction);
  assert.strictEqual(reducer(revised, revisionAction), revised);

  const implicitIdentityAction = {
    ...revisionAction,
    revisionVersionId: undefined,
    text: 'A deterministic implicit revision retry.',
  };
  const implicitRevision = reducer(submitted, implicitIdentityAction);
  assert.strictEqual(reducer(implicitRevision, implicitIdentityAction), implicitRevision);

  const secondEntry = submit(revised, 'other-entry');
  const crossEntryCollision = {
    ...revisionAction,
    entryId: 'same',
    revisionVersionId: 'draft-other-entry',
    text: 'This colliding version must not land.',
  };
  assert.strictEqual(reducer(secondEntry, crossEntryCollision), secondEntry);
});

test('adopting remote lineage rebases only proven fresh local operations and is idempotent', () => {
  const local = submit(makeInitialState(), 'fresh-local', 'Local fresh writing has ten words here today.', 10);
  const localGain = local.writer.xp;
  const remote = makeInitialState();
  remote.entries = [entry('remote-legacy', 'Remote legacy writing remains too.', 10)];
  remote.writer = { ...remote.writer, xp: 345, totalWords: 10, totalChallenges: 1 };
  remote.progress.baseline = {
    ...remote.progress.baseline,
    provenance: 'legacy-local',
    xp: 345,
    totalWords: 10,
    totalChallenges: 1,
  };

  const merged = mergeAppStates(local, remote, true);
  assert.deepEqual(merged.entries.map((item) => item.id).sort(), ['fresh-local', 'remote-legacy']);
  assert.equal(merged.writer.xp, 345 + localGain);
  assert.equal(merged.writer.totalWords, 20);
  assert.equal(merged.progress.operations.some((operation) => operation.id === 'submit:fresh-local' && operation.baselineId === merged.progress.baseline.id), true);
  const repeated = mergeAppStates(merged, remote, true);
  assert.equal(stableStringify(toCloudPayload(repeated)), stableStringify(toCloudPayload(merged)));
});

test('fact conflicts converge independent of operand order without fabricating rewards', () => {
  const base = submit(makeInitialState(), 'fact-conflict', 'Canonical first draft text.', 4);
  const variant = structuredClone(base);
  variant.entries[0].text = 'A conflicting first draft survives as history.';
  variant.entries[0].versions[0].text = variant.entries[0].text;

  const leftRight = mergeAppStates(base, variant);
  const rightLeft = mergeAppStates(variant, base);
  assert.equal(stableStringify(toCloudPayload(leftRight)), stableStringify(toCloudPayload(rightLeft)));
  assert.equal(leftRight.entries[0].versions.length, 2);
  assert.equal(leftRight.entries[0].versions.filter((version) => version.kind === 'conflict').length, 1);
  assert.equal(leftRight.entries[0].revisionCount, 0);
  assert.equal(leftRight.writer.xp, base.writer.xp);
  assert.equal(
    stableStringify(toCloudPayload(mergeAppStates(leftRight, variant))),
    stableStringify(toCloudPayload(leftRight)),
  );

  const operationVariant = structuredClone(base);
  operationVariant.progress.operations[0].xpDelta += 1;
  const opAB = mergeAppStates(base, operationVariant);
  const opBA = mergeAppStates(operationVariant, base);
  assert.equal(stableStringify(toCloudPayload(opAB)), stableStringify(toCloudPayload(opBA)));
  assert.equal(opAB.progress.operations.length, 2);
  assert.equal(opAB.progress.operations.filter((operation) => operation.baselineId.startsWith('conflict:')).length, 1);
  assert.equal(stableStringify(toCloudPayload(mergeAppStates(opAB, operationVariant))), stableStringify(toCloudPayload(opAB)));
});

test('a valid same-ID reward proof wins over lexicographically smaller damaged operation data', () => {
  const valid = submit(makeInitialState(), 'valid-operation');
  assert.equal(valid.writer.xp, 92);
  const damaged = structuredClone(valid);
  damaged.progress.operations[0].xpDelta = 10;
  damaged.writer.xp = 10;

  for (const merged of [mergeAppStates(valid, damaged), mergeAppStates(damaged, valid)]) {
    const canonical = merged.progress.operations.find((operation) => operation.id === 'submit:valid-operation');
    const fenced = merged.progress.operations.find((operation) => operation.id.startsWith('submit:valid-operation~conflict-'));
    assert.equal(canonical.xpDelta, 92);
    assert.equal(fenced.xpDelta, 10);
    assert.equal(fenced.baselineId.startsWith('conflict:'), true);
    assert.equal(merged.writer.xp, 92);
    assert.equal(stableStringify(toCloudPayload(mergeAppStates(merged, damaged))), stableStringify(toCloudPayload(merged)));
    const roundTrip = parseImportBundle(JSON.stringify(createExportBundle(merged)));
    assert.equal(stableStringify(toCloudPayload(roundTrip)), stableStringify(toCloudPayload(merged)));
  }
});

test('three-way version merges converge and keep immutable first drafts', () => {
  const base = submit(makeInitialState(), 'three-way', 'The immutable first draft.', 4);
  const left = revise(structuredClone(base), 'three-way', 'left-v1', 'Left branch revision.', NOW + 10);
  const middle = revise(structuredClone(base), 'three-way', 'middle-v1', 'Middle branch revision.', NOW + 20);
  const right = revise(structuredClone(base), 'three-way', 'right-v1', 'Right branch revision.', NOW + 30);
  const firstGrouping = mergeAppStates(mergeAppStates(left, middle), right);
  const secondGrouping = mergeAppStates(left, mergeAppStates(middle, right));
  assert.equal(stableStringify(toCloudPayload(firstGrouping)), stableStringify(toCloudPayload(secondGrouping)));
  assert.equal(firstGrouping.entries[0].versions.some((version) => version.text === 'The immutable first draft.'), true);
});

test('four concurrent revisions retain every branch but credit only the canonical first two', () => {
  const base = submit(makeInitialState(), 'ceiling', 'Shared original.', 2);
  const leftOne = revise(structuredClone(base), 'ceiling', 'left-1', 'Left first revision.', NOW + 10);
  const leftTwo = revise(leftOne, 'ceiling', 'left-2', 'Left second revision.', NOW + 30);
  const rightOne = revise(structuredClone(base), 'ceiling', 'right-1', 'Right first revision.', NOW + 20);
  const rightTwo = revise(rightOne, 'ceiling', 'right-2', 'Right second revision.', NOW + 40);

  const ab = mergeAppStates(leftTwo, rightTwo);
  const ba = mergeAppStates(rightTwo, leftTwo);
  assert.equal(stableStringify(toCloudPayload(ab)), stableStringify(toCloudPayload(ba)));
  assert.equal(ab.entries[0].versions.length, 5);
  assert.equal(ab.entries[0].revisionCount, 2);
  assert.equal(ab.writer.xp, base.writer.xp + 16);
  assert.equal(ab.progress.operations.filter((operation) => operation.kind === 'entry-revision').length, 4);
  assert.equal(ab.entries[0].versions.filter((version) => version.kind === 'revision' && version.xpDelta === 8).length, 4);
  assert.deepEqual(
    ab.entries[0].versions.map((version) => version.text).sort(),
    ['Shared original.', 'Left first revision.', 'Left second revision.', 'Right first revision.', 'Right second revision.'].sort(),
  );

  const roundTrip = normalizeAppState(toCloudPayload(ab), 'cloud');
  assert.equal(roundTrip.writer.xp, base.writer.xp + 16);
  assert.equal(roundTrip.entries[0].revisionCount, 2);
  assert.equal(stableStringify(toCloudPayload(roundTrip)), stableStringify(toCloudPayload(ab)));
  assert.equal(stableStringify(toCloudPayload(mergeAppStates(ab, rightTwo))), stableStringify(toCloudPayload(ab)));
  assert.equal(stableStringify(toCloudPayload(mergeAppStates(leftTwo, ab))), stableStringify(toCloudPayload(ab)));
});

test('activity snapshots never resurrect same-date grace and allow a legitimate later earn', () => {
  const base = submit(makeInitialState(), 'activity');
  const spent = structuredClone(base);
  spent.writer = { ...spent.writer, lastPlayDate: '2026-10-03', streak: 8, graceTokens: 0 };
  const stale = structuredClone(base);
  stale.writer = { ...stale.writer, lastPlayDate: '2026-10-03', streak: 8, graceTokens: 1 };
  assert.equal(mergeAppStates(spent, stale).writer.graceTokens, 0);
  assert.equal(mergeAppStates(stale, spent).writer.graceTokens, 0);

  const later = structuredClone(base);
  later.writer = { ...later.writer, lastPlayDate: '2026-10-04', streak: 9, graceTokens: 1 };
  for (const merged of [mergeAppStates(spent, later), mergeAppStates(later, spent)]) {
    assert.equal(merged.writer.lastPlayDate, '2026-10-04');
    assert.equal(merged.writer.streak, 9);
    assert.equal(merged.writer.graceTokens, 1);
  }
});

test('incomplete grades remain text-only across analytics, presentation, and max-score facts', () => {
  const valid = entry('graded');
  const unavailable = { ...entry('unavailable', 'Never lose these recovered words.'), gradingComplete: false };
  unavailable.judge = makeJudge(100, 'platinum');
  const average = averageBreakdown([valid, unavailable], 1);
  assert.deepEqual(average, valid.judge.breakdown);
  assert.deepEqual(dimensionSeries([valid, unavailable], 1).imagery, [valid.judge.breakdown.imagery]);
  assert.equal(averageBreakdown([unavailable]), null);
  assert.deepEqual(dimensionSeries([unavailable]).voice, []);
  assert.deepEqual(gradingPresentation(unavailable), { available: false, tierText: 'Grade unavailable', scoreText: '' });

  const normalized = normalizeAppState({
    version: 3,
    writer: { ...makeInitialState().writer, maxScore: 100, totalWords: unavailable.wordCount, totalChallenges: 1 },
    entries: [unavailable],
  });
  assert.equal(normalized.entries[0].text, unavailable.text);
  assert.equal(normalized.writer.totalWords, unavailable.wordCount);
  assert.equal(normalized.writer.totalChallenges, 1);
  assert.equal(normalized.writer.maxScore, 0);
  assert.equal(normalized.memory.sampleCount, 0);

  const outOfBounds = normalizeAppState({
    version: 3,
    writer: { ...makeInitialState().writer, maxScore: 999, totalWords: 4, totalChallenges: 1 },
    entries: [{
      ...entry('out-of-bounds', 'Bounds do not erase text.', 4),
      judge: {
        ...makeJudge(80, 'platinum'),
        score: 999,
        breakdown: { vocabulary: 999, imagery: 8, voice: 7, structure: 7, originality: 8 },
      },
      versions: [{
        id: 'bad-version', entryId: 'out-of-bounds', parentVersionId: null, revision: 0, kind: 'legacy-current',
        createdAt: NOW, text: 'Bounds do not erase text.', wordCount: 4,
        judge: { ...makeJudge(80, 'platinum'), score: 999, breakdown: { vocabulary: 999, imagery: 8, voice: 7, structure: 7, originality: 8 } },
        gradingComplete: true, xpDelta: 0,
      }],
      currentVersionId: 'bad-version',
    }],
  });
  assert.equal(outOfBounds.entries[0].text, 'Bounds do not erase text.');
  assert.equal(outOfBounds.entries[0].gradingComplete, false);
  assert.equal(outOfBounds.entries[0].versions[0].gradingComplete, false);
  assert.equal(outOfBounds.writer.maxScore, 0);
});

test('historical grading uses only each version own proof and retains one latest valid score per piece', () => {
  const currentJudge = makeJudge(84, 'gold');
  const current = entry('historical-own-judge', 'The current graded draft.', 4);
  current.judge = currentJudge;
  current.revisionCount = 1;
  current.versions = [
    {
      id: 'old-missing-judge', entryId: current.id, parentVersionId: null, revision: 0, kind: 'legacy-current',
      createdAt: NOW - 20, text: 'An older draft has no judge.', wordCount: 6, gradingComplete: true, xpDelta: 0,
    },
    {
      id: 'current-valid', entryId: current.id, parentVersionId: 'old-missing-judge', revision: 1, kind: 'revision',
      createdAt: NOW, text: current.text, wordCount: current.wordCount, judge: currentJudge, gradingComplete: true, xpDelta: 8,
    },
  ];
  current.currentVersionId = 'current-valid';
  const ownJudge = normalizeAppState({
    version: 3,
    writer: { ...makeInitialState().writer, xp: 17.5, totalWords: 4, totalChallenges: 1 },
    entries: [current],
  });
  assert.equal(ownJudge.entries[0].versions.find((version) => version.id === 'old-missing-judge').gradingComplete, false);
  assert.equal(ownJudge.entries[0].versions.find((version) => version.id === 'old-missing-judge').judge.score, 0);
  assert.equal(ownJudge.entries[0].gradingComplete, true);

  const incomplete = entry('historical-valid', 'The latest grade is unavailable.', 5);
  delete incomplete.judge;
  incomplete.gradingComplete = false;
  incomplete.revisionCount = 1;
  incomplete.versions = [
    {
      id: 'older-score-90', entryId: incomplete.id, parentVersionId: null, revision: 0, kind: 'legacy-current',
      createdAt: NOW - 30, text: 'An older honestly graded draft.', wordCount: 5,
      judge: makeJudge(90, 'gold'), gradingComplete: true, xpDelta: 0,
    },
    {
      id: 'latest-incomplete', entryId: incomplete.id, parentVersionId: 'older-score-90', revision: 1, kind: 'revision',
      createdAt: NOW, text: incomplete.text, wordCount: incomplete.wordCount, gradingComplete: true, xpDelta: 8,
    },
  ];
  incomplete.currentVersionId = 'latest-incomplete';
  const historical = normalizeAppState({
    version: 3,
    writer: { ...makeInitialState().writer, xp: 21.25, maxScore: 999, totalWords: 5, totalChallenges: 1 },
    entries: [incomplete],
  });
  assert.equal(historical.entries[0].gradingComplete, false);
  assert.deepEqual(gradingPresentation(historical.entries[0]), { available: false, tierText: 'Grade unavailable', scoreText: '' });
  assert.equal(historical.entries[0].versions.find((version) => version.id === 'latest-incomplete').gradingComplete, false);
  assert.equal(historical.writer.maxScore, 90);
  assert.equal(historical.memory.sampleCount, 1);
  assert.equal(historical.memory.bestScore, 90);
  assert.deepEqual(dimensionSeries(historical.entries).imagery, [makeJudge(90).breakdown.imagery]);
  const merged = mergeAppStates(historical, structuredClone(historical));
  assert.equal(merged.writer.maxScore, 90);
  assert.equal(merged.memory.sampleCount, 1);
});

test('historical max score keeps every valid immutable version through import and merge orders', () => {
  const historicalEntry = entry('historical-max', 'The latest grade is unavailable.', 5);
  delete historicalEntry.judge;
  historicalEntry.gradingComplete = false;
  historicalEntry.revisionCount = 2;
  historicalEntry.versions = [
    {
      id: 'first-grade-90', entryId: historicalEntry.id, parentVersionId: null, revision: 0, kind: 'first-draft',
      createdAt: NOW - 60, text: 'An honestly graded first draft.', wordCount: 5,
      judge: makeJudge(90, 'gold'), gradingComplete: true, xpDelta: 97,
    },
    {
      id: 'revision-grade-70', entryId: historicalEntry.id, parentVersionId: 'first-grade-90', revision: 1, kind: 'revision',
      createdAt: NOW - 30, text: 'A later valid revision.', wordCount: 5,
      judge: makeJudge(70, 'gold'), gradingComplete: true, xpDelta: 8,
    },
    {
      id: 'latest-incomplete', entryId: historicalEntry.id, parentVersionId: 'revision-grade-70', revision: 2, kind: 'revision',
      createdAt: NOW, text: historicalEntry.text, wordCount: historicalEntry.wordCount, gradingComplete: true, xpDelta: 8,
    },
  ];
  historicalEntry.currentVersionId = 'latest-incomplete';
  historicalEntry.firstDraft = {
    versionId: 'first-grade-90',
    createdAt: NOW - 60,
    wordCount: 5,
    xpAwarded: 97,
  };

  const raw = {
    version: 3,
    writer: { ...makeInitialState().writer, xp: 21.25, maxScore: 999, totalWords: 5, totalChallenges: 1 },
    entries: [historicalEntry],
  };
  const normalized = normalizeAppState(raw);
  assert.equal(normalized.writer.maxScore, 90);
  assert.equal(normalized.writer.xp, 21.25);
  assert.equal(normalized.writer.totalWords, 5);
  assert.equal(normalized.writer.totalChallenges, 1);
  assert.equal(normalized.entries[0].revisionCount, 2);
  assert.equal(normalized.entries[0].gradingComplete, false);
  assert.equal(normalized.entries[0].judge.score, 0);
  assert.equal(normalized.memory.sampleCount, 1);
  assert.equal(normalized.memory.bestScore, 70);

  const imported = parseImportBundle(JSON.stringify(createExportBundle(normalized)));
  assert.equal(imported.writer.maxScore, 90);
  assert.equal(imported.memory.sampleCount, 1);
  assert.equal(imported.memory.bestScore, 70);
  assert.equal(imported.entries[0].gradingComplete, false);
  assert.equal(imported.entries[0].revisionCount, 2);

  for (const [left, right] of [[normalized, imported], [imported, normalized]]) {
    const merged = mergeAppStates(left, structuredClone(right));
    assert.equal(merged.writer.maxScore, 90);
    assert.equal(merged.memory.sampleCount, 1);
    assert.equal(merged.memory.bestScore, 70);
    assert.equal(merged.entries[0].gradingComplete, false);
    assert.equal(merged.entries[0].revisionCount, 2);
    assert.equal(mergeAppStates(merged, left).writer.maxScore, 90);
    assert.equal(mergeAppStates(left, merged).writer.maxScore, 90);
  }
});

test('unmatched top-level latest writing becomes a deterministic zero-reward current version', (t) => {
  const storage = withStorage(t);
  const cases = [
    { id: 'latest-valid', currentVersionId: undefined, validTop: true },
    { id: 'latest-incomplete', currentVersionId: 'old-explicit', validTop: false },
  ];

  for (const fixture of cases) {
    const latestJudge = fixture.validTop ? makeJudge(87, 'gold') : undefined;
    const oldJudge = fixture.validTop ? undefined : makeJudge(80, 'gold');
    const sourceEntry = {
      ...entry(fixture.id, 'latest actual text', 3),
      revisionCount: fixture.validTop ? 0 : 1,
      gradingComplete: fixture.validTop,
      versions: [{
        id: 'old-explicit', entryId: fixture.id, parentVersionId: null, revision: 0, kind: 'legacy-current',
        createdAt: NOW - 100, text: 'old ungraded text', wordCount: 3,
        ...(oldJudge ? { judge: oldJudge } : {}), gradingComplete: !!oldJudge, xpDelta: 0,
      }],
      ...(fixture.currentVersionId ? { currentVersionId: fixture.currentVersionId } : {}),
    };
    if (latestJudge) sourceEntry.judge = latestJudge;
    else delete sourceEntry.judge;
    const raw = {
      version: 3,
      writer: { ...makeInitialState().writer, xp: 31.75, totalWords: 3, totalChallenges: 1 },
      earnings: { ledger: [], lifetimePaid: 0, lifetimePending: 9 },
      entries: [sourceEntry],
    };
    const normalized = normalizeAppState(raw);
    const normalizedEntry = normalized.entries[0];
    assert.equal(normalizedEntry.text, 'latest actual text');
    assert.deepEqual(normalizedEntry.versions.map((version) => version.text).sort(), ['latest actual text', 'old ungraded text']);
    assert.equal(normalizedEntry.versions.find((version) => version.text === 'latest actual text').kind, 'legacy-current');
    assert.equal(normalizedEntry.versions.find((version) => version.text === 'latest actual text').xpDelta, 0);
    assert.equal(normalizedEntry.firstDraft, undefined);
    assert.equal(normalizedEntry.revisionCount, fixture.validTop ? 0 : 1);
    assert.equal(normalized.writer.xp, 31.75);
    assert.equal(normalized.progress.operations.length, 0);
    assert.equal(normalized.earnings.lifetimePending, 0);
    assert.equal(gradingPresentation(normalizedEntry).available, fixture.validTop);
    assert.equal(normalizedEntry.versions.find((version) => version.text === 'old ungraded text').gradingComplete, !!oldJudge);

    const olderBranch = structuredClone(normalized);
    const oldVersion = structuredClone(normalizedEntry.versions.find((version) => version.text === 'old ungraded text'));
    olderBranch.entries[0] = {
      ...olderBranch.entries[0],
      text: oldVersion.text,
      wordCount: oldVersion.wordCount,
      judge: oldVersion.judge,
      gradingComplete: oldVersion.gradingComplete,
      revisionCount: 0,
      versions: [oldVersion],
      currentVersionId: oldVersion.id,
    };
    const older = normalizeAppState(toCloudPayload(olderBranch), 'cloud');
    const ab = mergeAppStates(normalized, older);
    const ba = mergeAppStates(older, normalized);
    assert.equal(stableStringify(toCloudPayload(ab)), stableStringify(toCloudPayload(ba)));
    assert.equal(ab.entries[0].text, 'latest actual text');
    assert.deepEqual(ab.entries[0].versions.map((version) => version.text).sort(), ['latest actual text', 'old ungraded text']);
    assert.equal(stableStringify(toCloudPayload(mergeAppStates(ab, older))), stableStringify(toCloudPayload(ab)));
    const roundTrip = parseImportBundle(JSON.stringify(createExportBundle(ab)));
    assert.equal(stableStringify(toCloudPayload(roundTrip)), stableStringify(toCloudPayload(ab)));

    if (fixture.currentVersionId) {
      const rawText = JSON.stringify(raw);
      storage.setItem(STORAGE_KEY, rawText);
      hydrate();
      assert.equal(storage.getItem(RAW_RECOVERY_FIRST_KEY), rawText);
    }
  }
});

test('cloud metadata writes require exact durable readback and remain retryable', (t) => {
  const storage = withStorage(t);
  const state = makeInitialState();
  const meta = {
    schema: 1,
    lineageId: state.progress.lineageId,
    generation: state.progress.generation,
    spaceId: null,
    serverVersion: 0,
    recoveryCode: generateRecoveryCode(),
    lastSavedAt: null,
    lastPayloadHash: null,
    pending: null,
  };
  assert.equal(writeCloudMeta(meta), true);
  assert.deepEqual(readCloudMeta(), meta);
  const exactMeta = storage.getItem(CLOUD_META_KEY);
  storage.ignoreKey(CLOUD_META_KEY);
  assert.equal(writeCloudMeta({ ...meta, serverVersion: 1 }), false);
  assert.equal(storage.getItem(CLOUD_META_KEY), exactMeta);
  assert.deepEqual(readCloudMeta(), meta);
});

test('reset archives cloud linkage before invalidation and stops byte-exact on quota or readback failure', (t) => {
  const storage = withStorage(t);
  const state = submit(makeInitialState(), 'reset-archive');
  const meta = {
    schema: 1,
    lineageId: state.progress.lineageId,
    generation: state.progress.generation,
    spaceId: '77777777-7777-4777-8777-777777777777',
    serverVersion: 4,
    recoveryCode: generateRecoveryCode(),
    lastSavedAt: '2026-10-03T16:00:00.000Z',
    lastPayloadHash: 'old-hash',
    pending: null,
  };
  assert.equal(writeCloudMeta(meta), true);
  const exactMeta = storage.getItem(CLOUD_META_KEY);
  const exactState = JSON.stringify(toCloudPayload(state));
  storage.setItem(STORAGE_KEY, exactState);

  let invalidations = 0;
  storage.failKey(CLOUD_ARCHIVE_KEY);
  assert.equal(archiveCloudMetaBeforeNewLineage(() => { invalidations += 1; }), false);
  assert.equal(invalidations, 0);
  assert.equal(storage.getItem(CLOUD_META_KEY), exactMeta);
  assert.equal(storage.getItem(STORAGE_KEY), exactState);

  storage.allowKey(CLOUD_ARCHIVE_KEY);
  storage.ignoreKey(CLOUD_ARCHIVE_KEY);
  assert.equal(archiveCloudMetaBeforeNewLineage(() => { invalidations += 1; }), false);
  assert.equal(invalidations, 0);
  assert.equal(storage.getItem(CLOUD_META_KEY), exactMeta);
  assert.equal(storage.getItem(STORAGE_KEY), exactState);

  storage.respectKey(CLOUD_ARCHIVE_KEY);
  assert.equal(archiveCloudMetaBeforeNewLineage(() => { invalidations += 1; }), true);
  assert.equal(invalidations, 1);
  assert.equal(storage.getItem(CLOUD_META_KEY), null);
  assert.equal(JSON.parse(storage.getItem(CLOUD_ARCHIVE_KEY))[0].recoveryCode, meta.recoveryCode);
  assert.equal(storage.getItem(STORAGE_KEY), exactState);
});

test('explicit archive failure never detaches the active metadata record', (t) => {
  const storage = withStorage(t);
  const state = makeInitialState();
  const meta = {
    schema: 1,
    lineageId: state.progress.lineageId,
    generation: state.progress.generation,
    spaceId: '88888888-8888-4888-8888-888888888888',
    serverVersion: 1,
    recoveryCode: generateRecoveryCode(),
    lastSavedAt: null,
    lastPayloadHash: null,
    pending: null,
  };
  assert.equal(writeCloudMeta(meta), true);
  const exactMeta = storage.getItem(CLOUD_META_KEY);
  storage.failKey(CLOUD_ARCHIVE_KEY);
  assert.equal(archiveAndDetachCloudMeta(), false);
  assert.equal(storage.getItem(CLOUD_META_KEY), exactMeta);
  assert.deepEqual(readCloudMeta(), meta);
});

test('unavailable placeholder tiers cannot unlock grading badges or badge progress', () => {
  const state = makeInitialState();
  state.entries = [{ ...entry('placeholder-tier'), gradingComplete: false, judge: makeJudge(100, 'platinum') }];
  for (const id of ['silver1', 'gold1', 'platinum1']) {
    const definition = BADGES.find((badge) => badge.id === id);
    assert.ok(definition);
    assert.equal(definition.check(state), false);
    assert.equal(badgeProgress(id, state, definition).current, 0);
  }
});
