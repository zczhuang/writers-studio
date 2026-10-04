import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_REVISIONS,
  canReviseEntry,
  getRevisionRewardAvailability,
  resolveRevisionReward,
} from '../src/services/revision.ts';
import { reducer } from '../src/state/reducer.ts';
import { CURRENT_VERSION, STORAGE_KEY, makeInitialState } from '../src/state/initialState.ts';
import { hydrate } from '../src/state/persistence.ts';
import {
  resolveFreshReward,
  startLocalDayWatcher,
  summarizeDailyCap,
} from '../src/services/dailyCap.ts';
import {
  parentAccessIsActive,
  remainingCooldownSeconds,
  startDeadlineWatcher,
} from '../src/services/accessTiming.ts';

const currentDate = new Date();
const NOW = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0).getTime();
const priorDate = new Date(NOW);
priorDate.setDate(priorDate.getDate() - 1);
const YESTERDAY = priorDate.getTime();

function localDateIso(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const SCORES = {
  none: 40,
  bronze: 60,
  silver: 72,
  gold: 86,
  platinum: 95,
};

function makeJudge(tier, score = SCORES[tier]) {
  return {
    score,
    tier,
    breakdown: {
      vocabulary: Math.min(10, Math.round(score / 10)),
      imagery: 7,
      voice: 7,
      structure: 7,
      originality: 7,
    },
    strengths: ['A specific strength.'],
    suggestions: ['Try one more precise detail.'],
    celebrate: 'You kept shaping the piece.',
    source: 'heuristic',
  };
}

function makeEntry(overrides = {}) {
  return {
    id: 'entry-1',
    date: localDateIso(NOW),
    createdAt: NOW,
    mode: 'scene',
    challengeId: 'sc1',
    challengeTitle: 'The Stormy Beach',
    prompt: 'Write the storm.',
    text: 'Original writing with enough words to make a useful first draft.',
    wordCount: 11,
    judge: makeJudge('silver'),
    earningsId: 'ledger-1',
    revisionCount: 0,
    ...overrides,
  };
}

function makeLedger(overrides = {}) {
  return {
    id: 'ledger-1',
    entryId: 'entry-1',
    amount: 0.25,
    tier: 'silver',
    status: 'pending',
    createdAt: NOW,
    ...overrides,
  };
}

function sumByStatus(ledger, status) {
  return ledger.filter((row) => row.status === status).reduce((sum, row) => sum + row.amount, 0);
}

function makeState({ entry = makeEntry(), ledger = makeLedger(), extraLedger = [], cap = 1.5, capBehavior = 'forfeit' } = {}) {
  const initial = makeInitialState();
  const allLedger = ledger ? [ledger, ...extraLedger] : [...extraLedger];
  return {
    ...initial,
    writer: { ...initial.writer, xp: 100, maxScore: entry.judge.score },
    entries: [entry],
    earnings: {
      ledger: allLedger,
      lifetimePaid: sumByStatus(allLedger, 'paid'),
      lifetimePending: sumByStatus(allLedger, 'pending'),
    },
    settings: { ...initial.settings, dailyCapDollars: cap, capBehavior },
    revisingEntryId: entry.id,
  };
}

function reviseAction({ tier = 'gold', score = SCORES[tier], text = 'A stronger revision with more precise and vivid details.' } = {}) {
  return {
    type: 'REVISE_ENTRY',
    entryId: 'entry-1',
    text,
    wordCount: text.split(/\s+/).length,
    judge: makeJudge(tier, score),
    // Intentionally hostile: reducer policy must ignore every submitted value.
    ledgerPatch: { amount: 999, tier: 'none', status: 'paid' },
  };
}

function freshSubmitAction({ tier = 'platinum', score = SCORES[tier] } = {}) {
  const entry = makeEntry({
    id: 'entry-new',
    earningsId: 'ledger-new',
    judge: makeJudge(tier, score),
    revisionCount: 0,
  });
  return {
    type: 'SUBMIT_ENTRY',
    entry,
    // Intentionally hostile: the reducer must derive every reward field itself.
    ledger: {
      id: 'ledger-new',
      entryId: 'wrong-entry',
      amount: 999,
      tier: 'none',
      status: 'paid',
      createdAt: YESTERDAY,
      paidAt: NOW,
      paidNote: 'forged',
    },
  };
}

function assertPracticeRevision(before, after, expectedText) {
  assert.strictEqual(after.earnings, before.earnings, 'practice-only revision must not rebuild earnings');
  assert.deepEqual(after.earnings.ledger, before.earnings.ledger, 'ledger rows must remain fully unchanged');
  assert.equal(after.entries[0].text, expectedText);
  assert.equal(after.entries[0].revisionCount, (before.entries[0].revisionCount ?? 0) + 1);
  assert.equal(after.writer.xp, before.writer.xp + 8);
  assert.equal(after.revisingEntryId, null);
}

test('paid revision is practice-only and cannot reopen or double-pay the row', () => {
  const ledger = makeLedger({ status: 'paid', paidAt: NOW - 1000, paidNote: 'Allowance', amount: 0.25 });
  const state = makeState({ ledger, cap: 5 });
  const action = reviseAction({ tier: 'platinum', text: 'Paid reward practice revision.' });
  const next = reducer(state, action);

  assertPracticeRevision(state, next, action.text);
  assert.deepEqual(next.earnings.ledger[0], ledger);
  assert.equal(next.earnings.lifetimePaid, 0.25);
  assert.equal(next.earnings.lifetimePending, 0);
});

test('forfeited revision is practice-only and preserves the closed row', () => {
  const ledger = makeLedger({ status: 'forfeited', amount: 0, tier: 'gold' });
  const state = makeState({ ledger, cap: 5 });
  const action = reviseAction({ tier: 'platinum', text: 'Forfeited reward practice revision.' });
  const next = reducer(state, action);

  assertPracticeRevision(state, next, action.text);
  assert.deepEqual(next.earnings.ledger[0], ledger);
});

test('older-day pending revision is practice-only and cannot evade today’s cap', () => {
  const ledger = makeLedger({ createdAt: YESTERDAY });
  const entry = makeEntry({ createdAt: YESTERDAY, date: localDateIso(YESTERDAY) });
  const state = makeState({ entry, ledger, cap: 5 });
  const action = reviseAction({ tier: 'platinum', text: 'Earlier day practice revision.' });
  const next = reducer(state, action);

  assert.equal(getRevisionRewardAvailability(ledger, NOW), 'older-day');
  assertPracticeRevision(state, next, action.text);
});

test('missing ledger remains practice-only while writing and feedback still update', () => {
  const state = makeState({ ledger: null, cap: 5 });
  const action = reviseAction({ tier: 'gold', text: 'Revision with no matching ledger.' });
  const next = reducer(state, action);

  assertPracticeRevision(state, next, action.text);
  assert.equal(next.lastJudge.tier, 'gold');
});

for (const capBehavior of ['lock', 'forfeit']) {
  for (const boundary of [
    { name: 'zero remaining', cap: 0.5, amount: 0.25, tier: 'silver', delta: 0 },
    { name: 'partial remaining', cap: 0.75, amount: 0.5, tier: 'platinum', delta: 0.25 },
    { name: 'exact remaining', cap: 1.25, amount: 1, tier: 'platinum', delta: 0.75 },
  ]) {
    test(`same-day pending revision clamps ${boundary.name} in ${capBehavior} mode`, () => {
      const other = makeLedger({ id: 'ledger-2', entryId: 'entry-2', amount: 0.25 });
      const state = makeState({ extraLedger: [other], cap: boundary.cap, capBehavior });
      const next = reducer(state, reviseAction({ tier: 'platinum' }));
      const revisedLedger = next.earnings.ledger.find((row) => row.id === 'ledger-1');

      assert.equal(revisedLedger.amount, boundary.amount);
      assert.equal(revisedLedger.tier, boundary.tier);
      assert.equal(revisedLedger.status, 'pending');
      assert.equal(next.earnings.lifetimePending, 0.5 + boundary.delta);
      assert.equal(next.writer.xp, state.writer.xp + 8);
    });
  }
}

test('today’s cap counts paid and pending rows while excluding forfeited rows', () => {
  const target = makeLedger();
  const paid = makeLedger({ id: 'paid', entryId: 'paid-entry', status: 'paid', amount: 0.25 });
  const forfeited = makeLedger({ id: 'forfeited', entryId: 'forfeited-entry', status: 'forfeited', amount: 9 });
  const decision = resolveRevisionReward({
    ledger: target,
    ledgerEntries: [target, paid, forfeited],
    candidateTier: 'platinum',
    dailyCapDollars: 0.75,
    nowMs: NOW,
  });

  assert.equal(decision.addedAmount, 0.25);
  assert.deepEqual(decision.patch, { amount: 0.5, tier: 'platinum', status: 'pending' });
});

for (const capBehavior of ['lock', 'forfeit']) {
  for (const boundary of [
    { name: 'partial remaining below the nominal reward', existing: 0.8, cap: 1, tier: 'platinum', expected: 0.2 },
    { name: 'exact remaining', existing: 0.5, cap: 1, tier: 'gold', expected: 0.5 },
  ]) {
    test(`fresh submission clamps ${boundary.name} in ${capBehavior} mode at the reducer boundary`, () => {
      const state = makeState({
        ledger: makeLedger({ amount: boundary.existing }),
        cap: boundary.cap,
        capBehavior,
      });
      const next = reducer(state, freshSubmitAction({ tier: boundary.tier }));
      const added = next.earnings.ledger.find((row) => row.id === 'ledger-new');

      assert.equal(next.entries.length, state.entries.length + 1);
      assert.deepEqual(added, {
        id: 'ledger-new',
        entryId: 'entry-new',
        amount: boundary.expected,
        tier: boundary.tier,
        status: 'pending',
        createdAt: added.createdAt,
      });
      assert.equal(localDateIso(added.createdAt), localDateIso(Date.now()));
      assert.equal(next.earnings.lifetimePending, boundary.existing + boundary.expected);
    });
  }
}

test('a staged fresh submission is rejected if lock-mode cap fills before reducer commit', () => {
  const stagedAction = freshSubmitAction({ tier: 'bronze' });
  const state = makeState({ ledger: makeLedger({ amount: 1 }), cap: 1, capBehavior: 'lock' });
  const next = reducer(state, stagedAction);

  assert.strictEqual(next, state);
  assert.equal(next.earnings.ledger.some((row) => row.id === 'ledger-new'), false);
});

test('fresh submission at zero remaining stays practice-only in forfeit mode', () => {
  const state = makeState({ ledger: makeLedger({ amount: 1 }), cap: 1, capBehavior: 'forfeit' });
  const next = reducer(state, freshSubmitAction({ tier: 'bronze' }));
  const added = next.earnings.ledger.find((row) => row.id === 'ledger-new');

  assert.equal(next.entries.length, state.entries.length + 1);
  assert.equal(added.amount, 0);
  assert.equal(added.tier, 'bronze');
  assert.equal(added.status, 'forfeited');
  assert.equal(next.earnings.lifetimePending, 1);
});

test('fresh reward policy uses the current local day and excludes earlier-day earnings', () => {
  const yesterday = makeLedger({ amount: 1, createdAt: YESTERDAY });
  const reward = resolveFreshReward({
    ledgerEntries: [yesterday],
    candidateTier: 'platinum',
    dailyCapDollars: 1,
    capBehavior: 'lock',
    nowMs: NOW,
  });

  assert.deepEqual(reward, { accepted: true, amount: 1, status: 'pending' });
});

test('a clipped prior award receives only the higher-tier difference, not a recovered old shortfall', () => {
  const target = makeLedger({ amount: 0.1, tier: 'silver' });
  const decision = resolveRevisionReward({
    ledger: target,
    ledgerEntries: [target],
    candidateTier: 'gold',
    dailyCapDollars: 5,
    nowMs: NOW,
  });

  assert.equal(decision.addedAmount, 0.25);
  assert.deepEqual(decision.patch, { amount: 0.35, tier: 'gold', status: 'pending' });
});

test('lower-scoring revision updates current feedback but retains the best earned reward and max score', () => {
  const entry = makeEntry({ judge: makeJudge('gold', 90) });
  const ledger = makeLedger({ amount: 0.1, tier: 'gold' });
  const state = makeState({ entry, ledger, cap: 5 });
  const action = reviseAction({ tier: 'silver', score: 70, text: 'A lower-scoring but still valid revision.' });
  const next = reducer(state, action);

  assertPracticeRevision(state, next, action.text);
  assert.equal(next.entries[0].judge.score, 70);
  assert.equal(next.writer.maxScore, 90);
  assert.deepEqual(next.earnings.ledger[0], ledger);
});

test('same-tier revision cannot top up a previously clipped amount', () => {
  const ledger = makeLedger({ amount: 0.1, tier: 'gold' });
  const decision = resolveRevisionReward({
    ledger,
    ledgerEntries: [ledger],
    candidateTier: 'gold',
    dailyCapDollars: 5,
    nowMs: NOW,
  });

  assert.equal(decision.reason, 'not-higher-tier');
  assert.equal(decision.rewardChanged, false);
  assert.deepEqual(decision.patch, { amount: 0.1, tier: 'gold', status: 'pending' });
});

test('reducer ignores a forged ledgerPatch and derives the eligible increase itself', () => {
  const state = makeState({ cap: 1.5 });
  const next = reducer(state, reviseAction({ tier: 'gold' }));
  const ledger = next.earnings.ledger[0];

  assert.deepEqual(ledger, { ...state.earnings.ledger[0], amount: 0.5, tier: 'gold', status: 'pending' });
  assert.equal(next.earnings.lifetimePending, 0.5);
  assert.equal(next.earnings.lifetimePaid, 0);
});

test('revision limit helper accepts only counts below two', () => {
  assert.equal(MAX_REVISIONS, 2);
  assert.equal(canReviseEntry(makeEntry({ revisionCount: undefined })), true);
  assert.equal(canReviseEntry(makeEntry({ revisionCount: 0 })), true);
  assert.equal(canReviseEntry(makeEntry({ revisionCount: 1 })), true);
  assert.equal(canReviseEntry(makeEntry({ revisionCount: 2 })), false);
  assert.equal(canReviseEntry(makeEntry({ revisionCount: 3 })), false);
  assert.equal(canReviseEntry(undefined), false);
});

test('two valid revisions grant +8 XP each and a repeated third action is an exact no-op', () => {
  const state = makeState({ cap: 5 });
  const first = reducer(state, reviseAction({ tier: 'gold', text: 'First revision.' }));
  const second = reducer(first, reviseAction({ tier: 'platinum', text: 'Second revision.' }));
  const repeated = reducer(second, reviseAction({ tier: 'platinum', text: 'Farmed third revision.' }));

  assert.equal(first.entries[0].revisionCount, 1);
  assert.equal(second.entries[0].revisionCount, 2);
  assert.equal(second.writer.xp, state.writer.xp + 16);
  assert.equal(second.entries[0].text, 'Second revision.');
  assert.strictEqual(repeated, second);
  assert.equal(repeated.writer.xp, state.writer.xp + 16);
  assert.equal(repeated.entries[0].text, 'Second revision.');
});

test('maxed and missing entries are rejected at START_REVISION and REVISE_ENTRY boundaries', () => {
  const maxed = makeState({ entry: makeEntry({ revisionCount: 2 }) });
  assert.strictEqual(reducer(maxed, { type: 'START_REVISION', entryId: 'entry-1' }), maxed);
  assert.strictEqual(reducer(maxed, reviseAction()), maxed);

  const missingStart = reducer(maxed, { type: 'START_REVISION', entryId: 'missing' });
  const missingRevise = reducer(maxed, { ...reviseAction(), entryId: 'missing' });
  assert.strictEqual(missingStart, maxed);
  assert.strictEqual(missingRevise, maxed);
});

class FakeWatcherRuntime {
  nowMs;
  #nextTimerId = 1;
  #timers = new Map();
  #focus = null;
  #visible = null;

  constructor(nowMs) {
    this.nowMs = nowMs;
  }

  now = () => this.nowMs;

  setTimer = (callback, delayMs) => {
    const id = this.#nextTimerId++;
    this.#timers.set(id, { callback, delayMs });
    return id;
  };

  clearTimer = (timerId) => {
    this.#timers.delete(timerId);
  };

  subscribeFocus = (callback) => {
    this.#focus = callback;
    return () => {
      if (this.#focus === callback) this.#focus = null;
    };
  };

  subscribeVisible = (callback) => {
    this.#visible = callback;
    return () => {
      if (this.#visible === callback) this.#visible = null;
    };
  };

  fireNextTimer() {
    const next = [...this.#timers.entries()].sort((a, b) => a[1].delayMs - b[1].delayMs)[0];
    assert.ok(next, 'expected an active timer');
    this.#timers.delete(next[0]);
    next[1].callback();
  }

  focus() {
    assert.ok(this.#focus, 'expected a focus listener');
    this.#focus();
  }

  visible() {
    assert.ok(this.#visible, 'expected a visibility listener');
    this.#visible();
  }

  get timerCount() {
    return this.#timers.size;
  }

  get hasSubscriptions() {
    return this.#focus !== null || this.#visible !== null;
  }
}

test('mounted daily-cap watcher rolls at local midnight and resyncs after a sleeping tab focuses', () => {
  const beforeMidnight = new Date(2026, 9, 3, 23, 59, 59, 900).getTime();
  const afterMidnight = new Date(2026, 9, 4, 0, 0, 0, 100).getTime();
  const afterSleep = new Date(2026, 9, 5, 9, 30, 0, 0).getTime();
  const firstDay = localDateIso(beforeMidnight);
  const secondDay = localDateIso(afterMidnight);
  const thirdDay = localDateIso(afterSleep);
  const ledger = [
    makeLedger({ id: 'day-one', amount: 0.75, createdAt: beforeMidnight }),
    makeLedger({ id: 'day-two', amount: 0.25, createdAt: afterMidnight }),
  ];
  const runtime = new FakeWatcherRuntime(beforeMidnight);
  const observed = [];

  assert.deepEqual(summarizeDailyCap(ledger, 0.75, firstDay), {
    earnedToday: 0.75,
    cap: 0.75,
    remaining: 0,
    capHit: true,
    pct: 100,
  });

  const stop = startLocalDayWatcher(firstDay, (localDay) => {
    observed.push({ localDay, cap: summarizeDailyCap(ledger, 0.75, localDay) });
  }, runtime);

  runtime.nowMs = afterMidnight;
  runtime.fireNextTimer();
  assert.deepEqual(observed[0], {
    localDay: secondDay,
    cap: { earnedToday: 0.25, cap: 0.75, remaining: 0.5, capHit: false, pct: 33 },
  });

  runtime.nowMs = afterSleep;
  runtime.focus();
  assert.deepEqual(observed[1], {
    localDay: thirdDay,
    cap: { earnedToday: 0, cap: 0.75, remaining: 0.75, capHit: false, pct: 0 },
  });

  runtime.visible();
  assert.equal(observed.length, 2, 'same-day foreground events must not emit duplicate rollovers');
  stop();
  assert.equal(runtime.timerCount, 0);
  assert.equal(runtime.hasSubscriptions, false);
});

test('PIN cooldown watcher reaches zero automatically and foreground resync covers sleep', () => {
  assert.equal(parentAccessIsActive(31_000, 30_999), true);
  assert.equal(parentAccessIsActive(31_000, 31_000), false);
  assert.equal(remainingCooldownSeconds(31_000, 31_000), 0);

  const runtime = new FakeWatcherRuntime(1_000);
  const observed = [];
  const stop = startDeadlineWatcher({
    deadlineMs: 31_000,
    tickEveryMs: 1_000,
    onTime: (nowMs) => observed.push(remainingCooldownSeconds(31_000, nowMs)),
    runtime,
  });

  runtime.nowMs = 2_000;
  runtime.fireNextTimer();
  assert.equal(observed.at(-1), 29);

  runtime.nowMs = 31_000;
  runtime.fireNextTimer();
  assert.equal(observed.at(-1), 0);
  assert.equal(runtime.timerCount, 0, 'expired cooldown must stop scheduling countdown work');
  stop();

  const sleepingRuntime = new FakeWatcherRuntime(50_000);
  const foregroundRemaining = [];
  const stopSleeping = startDeadlineWatcher({
    deadlineMs: 80_000,
    onTime: (nowMs) => foregroundRemaining.push(remainingCooldownSeconds(80_000, nowMs)),
    runtime: sleepingRuntime,
  });
  sleepingRuntime.nowMs = 90_000;
  sleepingRuntime.focus();
  assert.deepEqual(foregroundRemaining, [0]);
  assert.equal(sleepingRuntime.timerCount, 0);
  stopSleeping();
  assert.equal(sleepingRuntime.hasSubscriptions, false);
});

class MemoryStorage {
  #values = new Map();

  get length() {
    return this.#values.size;
  }

  clear() {
    this.#values.clear();
  }

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  key(index) {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

test('v2 hydration preserves money, writing, PIN, and totals while backfilling v3 memory and craft', (t) => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  });

  const entry = makeEntry({
    createdAt: YESTERDAY,
    date: localDateIso(YESTERDAY),
    text: 'Glittering thunderclouds crowded the horizon above the restless shoreline.',
  });
  delete entry.revisionCount;
  const paid = makeLedger({ status: 'paid', paidAt: NOW, paidNote: 'Weekly payout' });
  const fresh = makeInitialState();
  const v2 = {
    version: 2,
    writer: {
      ...fresh.writer,
      name: 'Leeann',
      xp: 345,
      totalWords: 987,
      totalChallenges: 12,
      maxScore: 84,
    },
    earnings: { ledger: [paid], lifetimePaid: 0.25, lifetimePending: 0 },
    entries: [entry],
    settings: {
      ...fresh.settings,
      parentPinHash: 'preserved-pin-hash',
      parentPinSalt: 'preserved-pin-salt',
      dailyCapDollars: 2.75,
      capBehavior: 'lock',
    },
    screen: 'result',
    navStack: ['home', 'write'],
    currentMode: 'scene',
    currentChallengeId: 'sc1',
    lastJudge: entry.judge,
    lastEntryId: entry.id,
    revisingEntryId: entry.id,
    parentUnlockedUntil: NOW + 60_000,
    parentGateTarget: 'settings',
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(v2));

  const hydrated = hydrate();

  assert.equal(STORAGE_KEY, 'ws_state_v2');
  assert.equal(CURRENT_VERSION, 3);
  assert.equal(hydrated.version, 3);
  assert.equal(hydrated.writer.name, 'Leeann');
  assert.equal(hydrated.writer.xp, 345);
  assert.equal(hydrated.writer.totalWords, 987);
  assert.equal(hydrated.writer.totalChallenges, 12);
  assert.deepEqual(hydrated.earnings, v2.earnings);
  assert.deepEqual(hydrated.entries, [entry]);
  assert.equal('revisionCount' in hydrated.entries[0], false);
  assert.equal(hydrated.settings.parentPinHash, 'preserved-pin-hash');
  assert.equal(hydrated.settings.parentPinSalt, 'preserved-pin-salt');
  assert.equal(hydrated.settings.dailyCapDollars, 2.75);
  assert.equal(hydrated.settings.capBehavior, 'lock');
  assert.equal(hydrated.memory.sampleCount, 1);
  assert.deepEqual(hydrated.memory.mastery, entry.judge.breakdown);
  assert.equal(hydrated.memory.piecesByMode.scene, 1);
  assert.equal(hydrated.memory.bestScore, entry.judge.score);
  assert.equal(hydrated.memory.updatedAt, entry.createdAt);
  assert.deepEqual(hydrated.craft, { practicedSkills: [], masteredSkills: [] });
  assert.equal(hydrated.screen, 'home');
  assert.deepEqual(hydrated.navStack, []);
  assert.equal(hydrated.currentMode, null);
  assert.equal(hydrated.currentChallengeId, null);
  assert.equal(hydrated.lastJudge, null);
  assert.equal(hydrated.lastEntryId, null);
  assert.equal(hydrated.revisingEntryId, null);
  assert.equal(hydrated.parentUnlockedUntil, 0);
  assert.equal(hydrated.parentGateTarget, null);
});
