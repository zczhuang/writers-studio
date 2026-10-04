import assert from 'node:assert/strict';
import test from 'node:test';

import { SyncEngine } from '../src/cloud/syncEngine.ts';
import { generateRecoveryCode } from '../src/cloud/recovery.ts';
import { toCloudPayload } from '../src/cloud/model.ts';
import { makeInitialState } from '../src/state/initialState.ts';
import { reducer } from '../src/state/reducer.ts';
import { sha256Hex } from '../src/utils/stable.ts';

const NOW = new Date(2026, 9, 3, 12, 0, 0).getTime();

function judge() {
  return {
    score: 82,
    tier: 'gold',
    breakdown: { vocabulary: 7, imagery: 8, voice: 7, structure: 7, originality: 8 },
    strengths: [],
    suggestions: [],
    celebrate: 'Keep going',
    source: 'heuristic',
  };
}

function submit(state, id) {
  return reducer(state, {
    type: 'SUBMIT_ENTRY',
    entry: {
      id,
      date: '2026-10-03',
      createdAt: NOW,
      mode: 'scene',
      challengeId: 'sc1',
      challengeTitle: 'A page',
      prompt: 'Write.',
      text: `Writing from ${id} with enough words for a proper page.`,
      wordCount: 10,
      judge: judge(),
      earningsId: `ledger-${id}`,
      revisionCount: 0,
    },
    ledger: {
      id: `ledger-${id}`,
      entryId: id,
      amount: 0.5,
      tier: 'gold',
      status: 'pending',
      createdAt: NOW,
    },
  });
}

function metaFor(state, overrides = {}) {
  return {
    schema: 1,
    lineageId: state.progress.lineageId,
    generation: state.progress.generation,
    spaceId: '11111111-1111-4111-8111-111111111111',
    serverVersion: 1,
    recoveryCode: generateRecoveryCode(),
    lastSavedAt: null,
    lastPayloadHash: null,
    pending: null,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function waitFor(predicate, message = 'condition') {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`Timed out waiting for ${message}`);
}

function makeEngine({ state, meta = null, transport, online = true, writeMeta, archiveMeta }) {
  let currentState = state;
  let currentMeta = meta;
  const statuses = [];
  const applied = [];
  const engine = new SyncEngine({
    transport,
    getState: () => currentState,
    applyState: (next) => { currentState = next; applied.push(next); },
    getMeta: () => currentMeta,
    setMeta: (next) => {
      if (writeMeta) return writeMeta(next, { get: () => currentMeta, set: (value) => { currentMeta = value; } });
      currentMeta = next;
      return true;
    },
    archiveCurrentMeta: archiveMeta,
    isOnline: () => online,
    onStatus: (status) => statuses.push(status),
    nowIso: () => '2026-10-03T16:00:00.000Z',
  });
  return {
    engine,
    statuses,
    applied,
    getState: () => currentState,
    setState: (next) => { currentState = next; },
    getMeta: () => currentMeta,
  };
}

test('blank and offline states remain device-only without anonymous sign-in or cloud creation', async () => {
  const calls = [];
  const transport = {
    createSpace: async () => { calls.push('create'); throw new Error('unexpected'); },
    pull: async () => { calls.push('pull'); throw new Error('unexpected'); },
    syncSpace: async () => { calls.push('sync'); throw new Error('unexpected'); },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const blank = makeEngine({ state: makeInitialState(), transport });
  await blank.engine.requestSync();
  assert.deepEqual(calls, []);
  assert.equal(blank.statuses.at(-1).phase, 'device-only');

  const offline = makeEngine({ state: submit(makeInitialState(), 'offline'), transport, online: false });
  await offline.engine.requestSync();
  assert.deepEqual(calls, []);
  assert.equal(offline.statuses.at(-1).phase, 'offline');
});

test('sync pulls before upload and follows an in-flight edit before reporting saved', async () => {
  const serverInitial = submit(makeInitialState(), 'server');
  let local = reducer(structuredClone(serverInitial), { type: 'UPDATE_WRITER', patch: { name: 'Leeann' } });
  let serverPayload = toCloudPayload(serverInitial);
  let serverHash = await sha256Hex(serverPayload);
  let version = 1;
  const firstAck = deferred();
  const order = [];
  const syncInputs = [];
  const transport = {
    createSpace: async () => { throw new Error('unexpected create'); },
    async pull(spaceId) {
      order.push('pull');
      return { status: 'ok', spaceId, generation: serverInitial.progress.generation, version, payload: serverPayload, payloadHash: serverHash, updatedAt: '2026-10-03T15:00:00.000Z' };
    },
    async syncSpace(input) {
      order.push('sync');
      syncInputs.push(input);
      if (syncInputs.length === 1) {
        await firstAck.promise;
      }
      serverPayload = input.payload;
      serverHash = input.payloadHash;
      version += 1;
      return { status: 'ok', spaceId: input.spaceId, generation: input.generation, version, payloadHash: serverHash, updatedAt: `2026-10-03T15:0${version}:00.000Z` };
    },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: local, meta: metaFor(local), transport });
  const run = fixture.engine.requestSync();
  await waitFor(() => syncInputs.length === 1, 'first upload');
  local = submit(fixture.getState(), 'during-upload');
  fixture.setState(local);
  firstAck.resolve();
  await run;

  assert.deepEqual(order, ['pull', 'sync', 'pull', 'sync']);
  assert.equal(syncInputs[1].payload.entries.some((item) => item.id === 'during-upload'), true);
  assert.equal(fixture.statuses.at(-1).phase, 'saved');
  assert.equal(fixture.getMeta().lastPayloadHash, syncInputs[1].payloadHash);
});

test('CAS conflict is retained, merged, repulled, and retried with both writers edits', async () => {
  const baseline = makeInitialState();
  const serverV1 = submit(structuredClone(baseline), 'base');
  const local = submit(structuredClone(serverV1), 'local');
  let server = serverV1;
  let version = 1;
  let first = true;
  const order = [];
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    async pull(spaceId) {
      order.push('pull');
      const payload = toCloudPayload(server);
      return { status: 'ok', spaceId, generation: server.progress.generation, version, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:00:00.000Z' };
    },
    async syncSpace(input) {
      order.push('sync');
      if (first) {
        first = false;
        server = submit(structuredClone(server), 'remote');
        version = 2;
        const payload = toCloudPayload(server);
        return { status: 'conflict', spaceId: input.spaceId, generation: input.generation, version, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:01:00.000Z' };
      }
      server = input.payload;
      version += 1;
      return { status: 'ok', spaceId: input.spaceId, generation: input.generation, version, payloadHash: input.payloadHash, updatedAt: '2026-10-03T15:02:00.000Z' };
    },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: local, meta: metaFor(local), transport });
  await fixture.engine.requestSync();

  assert.deepEqual(order, ['pull', 'sync', 'pull', 'sync']);
  assert.deepEqual(fixture.getState().entries.map((item) => item.id).sort(), ['base', 'local', 'remote']);
  assert.equal(fixture.statuses.at(-1).phase, 'saved');
});

test('network/device errors never clear local progress', async () => {
  const state = submit(makeInitialState(), 'safe-local');
  const before = structuredClone(state);
  const transport = {
    createSpace: async () => { throw new Error('network down'); },
    pull: async () => { throw new Error('network down'); },
    syncSpace: async () => { throw new Error('network down'); },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state, meta: metaFor(state), transport });
  await fixture.engine.requestSync();
  assert.deepEqual(fixture.getState(), before);
  assert.equal(fixture.statuses.at(-1).phase, 'error');
});

test('reset generation fence ignores an old delayed pull and cannot revive prior history', async () => {
  const oldState = submit(makeInitialState(), 'old-lineage');
  const pendingPull = deferred();
  let syncCalls = 0;
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async () => pendingPull.promise,
    syncSpace: async () => { syncCalls += 1; throw new Error('unexpected'); },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: oldState, meta: metaFor(oldState), transport });
  const run = fixture.engine.requestSync();
  const reset = reducer(oldState, { type: 'RESET_ALL' });
  fixture.engine.invalidate();
  fixture.setState(reset);
  const payload = toCloudPayload(oldState);
  pendingPull.resolve({
    status: 'ok',
    spaceId: metaFor(oldState).spaceId,
    generation: oldState.progress.generation,
    version: 1,
    payload,
    payloadHash: await sha256Hex(payload),
    updatedAt: '2026-10-03T15:00:00.000Z',
  });
  await run;

  assert.equal(syncCalls, 0);
  assert.equal(fixture.getState().entries.length, 0);
  assert.equal(fixture.applied.length, 0);
});

test('recovery keeps wrong claims local, enforces completion authorization, and links a valid claim', async () => {
  const remote = submit(makeInitialState(), 'recovered');
  const payload = toCloudPayload(remote);
  const code = generateRecoveryCode();
  let mode = 'invalid';
  const delayedClaim = deferred();
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    async pull(spaceId) {
      return { status: 'ok', spaceId, generation: remote.progress.generation, version: 1, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:00:00.000Z' };
    },
    syncSpace: async (input) => ({ status: 'ok', spaceId: input.spaceId, generation: input.generation, version: 2, payloadHash: input.payloadHash, updatedAt: '2026-10-03T15:01:00.000Z' }),
    async claimSpace() {
      if (mode === 'invalid') return { status: 'invalid' };
      if (mode === 'delayed') return delayedClaim.promise;
      return { status: 'ok', spaceId: '22222222-2222-4222-8222-222222222222', generation: remote.progress.generation, version: 1, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:00:00.000Z' };
    },
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: makeInitialState(), transport });
  const wrong = await fixture.engine.recover(code, () => true);
  assert.deepEqual(wrong, { ok: false, reason: 'invalid' });
  assert.equal(fixture.getState().entries.length, 0);

  mode = 'delayed';
  let authorized = true;
  const expiring = fixture.engine.recover(code, () => authorized);
  await waitFor(() => mode === 'delayed', 'delayed recovery');
  authorized = false;
  delayedClaim.resolve({ status: 'ok', spaceId: '22222222-2222-4222-8222-222222222222', generation: remote.progress.generation, version: 1, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:00:00.000Z' });
  assert.deepEqual(await expiring, { ok: false, reason: 'expired' });
  assert.equal(fixture.getState().entries.length, 0);

  mode = 'valid';
  const valid = await fixture.engine.recover(code, () => true);
  assert.deepEqual(valid, { ok: true });
  assert.equal(fixture.getState().entries[0].id, 'recovered');
  assert.equal(fixture.getMeta().recoveryCode, code);
  fixture.engine.stop();
});

test('duplicate create starts reuse one durable operation and one recovery code', async () => {
  const state = submit(makeInitialState(), 'strict-mode');
  let sharedMeta = null;
  const calls = [];
  const createGate = deferred();
  const transport = {
    async createSpace(input) {
      calls.push(input);
      await createGate.promise;
      return { status: 'ok', spaceId: '33333333-3333-4333-8333-333333333333', generation: input.generation, version: 1, payloadHash: input.payloadHash, updatedAt: '2026-10-03T15:00:00.000Z' };
    },
    pull: async () => { throw new Error('unexpected'); },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const options = {
    transport,
    getState: () => state,
    applyState: () => undefined,
    getMeta: () => sharedMeta,
    setMeta: (meta) => { sharedMeta = meta; return true; },
    isOnline: () => true,
    onStatus: () => undefined,
  };
  const first = new SyncEngine(options);
  const second = new SyncEngine(options);
  const firstRun = first.requestSync();
  const secondRun = second.requestSync();
  await waitFor(() => calls.length === 2, 'duplicate create requests');
  createGate.resolve();
  await Promise.all([firstRun, secondRun]);
  assert.equal(calls[0].operationId, calls[1].operationId);
  assert.equal(calls[0].recoveryCode, calls[1].recoveryCode);
});

test('create and sync mutations abort when pending metadata is not durable', async () => {
  const createCalls = [];
  const creating = submit(makeInitialState(), 'metadata-create');
  const createTransport = {
    createSpace: async (input) => { createCalls.push(input); throw new Error('must not run'); },
    pull: async () => { throw new Error('unexpected'); },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const createFixture = makeEngine({ state: creating, transport: createTransport, writeMeta: () => false });
  await createFixture.engine.requestSync();
  assert.equal(createCalls.length, 0);
  assert.equal(createFixture.statuses.at(-1).phase, 'error');

  const server = submit(makeInitialState(), 'metadata-sync');
  const local = reducer(structuredClone(server), { type: 'UPDATE_WRITER', patch: { name: 'Changed locally' } });
  const serverPayload = toCloudPayload(server);
  const syncCalls = [];
  const syncTransport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async (spaceId) => ({
      status: 'ok', spaceId, generation: server.progress.generation, version: 1,
      payload: serverPayload, payloadHash: await sha256Hex(serverPayload), updatedAt: '2026-10-03T15:00:00.000Z',
    }),
    syncSpace: async (input) => { syncCalls.push(input); throw new Error('must not run'); },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const syncFixture = makeEngine({ state: local, meta: metaFor(local), transport: syncTransport, writeMeta: () => false });
  await syncFixture.engine.requestSync();
  assert.equal(syncCalls.length, 0);
  assert.equal(syncFixture.statuses.at(-1).phase, 'error');
});

test('ACK metadata failure keeps durable intent, never says saved, and reuses the operation', async () => {
  const server = submit(makeInitialState(), 'ack-base');
  const local = reducer(structuredClone(server), { type: 'UPDATE_WRITER', patch: { name: 'Pending ACK' } });
  const serverPayload = toCloudPayload(server);
  const serverHash = await sha256Hex(serverPayload);
  const syncInputs = [];
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async (spaceId) => ({
      status: 'ok', spaceId, generation: server.progress.generation, version: 1,
      payload: serverPayload, payloadHash: serverHash, updatedAt: '2026-10-03T15:00:00.000Z',
    }),
    syncSpace: async (input) => {
      syncInputs.push(input);
      return { status: 'ok', spaceId: input.spaceId, generation: input.generation, version: 2, payloadHash: input.payloadHash, updatedAt: '2026-10-03T15:01:00.000Z' };
    },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  let rejectAck = true;
  const fixture = makeEngine({
    state: local,
    meta: metaFor(local),
    transport,
    writeMeta: (next, store) => {
      if (rejectAck && next.pending === null && next.serverVersion === 2) return false;
      store.set(next);
      return true;
    },
  });
  await fixture.engine.requestSync();
  assert.equal(syncInputs.length, 1);
  assert.equal(fixture.getMeta().pending.id, syncInputs[0].operationId);
  assert.equal(fixture.statuses.at(-1).phase, 'error');
  assert.equal(fixture.statuses.some((status) => status.phase === 'saved'), false);

  rejectAck = false;
  await fixture.engine.requestSync();
  assert.equal(syncInputs.length, 2);
  assert.equal(syncInputs[1].operationId, syncInputs[0].operationId);
  assert.equal(fixture.getMeta().pending, null);
  assert.equal(fixture.statuses.at(-1).phase, 'saved');
});

test('recovery linkage must be durable before recovered state is applied', async () => {
  const remote = submit(makeInitialState(), 'durable-recovery');
  const payload = toCloudPayload(remote);
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async () => { throw new Error('unexpected'); },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => ({
      status: 'ok', spaceId: '44444444-4444-4444-8444-444444444444', generation: remote.progress.generation,
      version: 1, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:00:00.000Z',
    }),
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: makeInitialState(), transport, writeMeta: () => false });
  const result = await fixture.engine.recover(generateRecoveryCode(), () => true);
  assert.deepEqual(result, { ok: false, reason: 'error' });
  assert.equal(fixture.applied.length, 0);
  assert.equal(fixture.getState().entries.length, 0);
});

test('recovery archives an existing linkage first and preserves it exactly on archive or replacement failure', async () => {
  const local = submit(makeInitialState(), 'existing-local-link');
  const oldMeta = metaFor(local, {
    spaceId: '44444444-4444-4444-8444-444444444440',
    recoveryCode: generateRecoveryCode(),
  });
  const remote = submit(makeInitialState(), 'replacement-remote-link');
  const payload = toCloudPayload(remote);
  const replacementSpace = '44444444-4444-4444-8444-444444444449';
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async () => { throw new Error('unexpected'); },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => ({
      status: 'ok', spaceId: replacementSpace, generation: remote.progress.generation,
      version: 1, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:00:00.000Z',
    }),
    onAuthChange: () => () => undefined,
  };

  let replacementWrites = 0;
  const archiveFailure = makeEngine({
    state: local,
    meta: structuredClone(oldMeta),
    transport,
    archiveMeta: (meta) => {
      assert.deepEqual(meta, oldMeta);
      return false;
    },
    writeMeta: () => { replacementWrites += 1; return false; },
  });
  assert.deepEqual(await archiveFailure.engine.recover(generateRecoveryCode(), () => true), { ok: false, reason: 'error' });
  assert.equal(replacementWrites, 0);
  assert.deepEqual(archiveFailure.getMeta(), oldMeta);
  assert.deepEqual(archiveFailure.getState(), local);
  assert.equal(archiveFailure.applied.length, 0);
  assert.equal(archiveFailure.statuses.some((status) => status.phase === 'saved'), false);

  const order = [];
  const replacementFailure = makeEngine({
    state: local,
    meta: structuredClone(oldMeta),
    transport,
    archiveMeta: (meta) => { order.push('archive'); assert.deepEqual(meta, oldMeta); return true; },
    writeMeta: (next, store) => {
      order.push(next.spaceId === replacementSpace ? 'replace' : 'restore');
      store.set(next);
      return next.spaceId !== replacementSpace;
    },
  });
  assert.deepEqual(await replacementFailure.engine.recover(generateRecoveryCode(), () => true), { ok: false, reason: 'error' });
  assert.deepEqual(order, ['archive', 'replace', 'restore']);
  assert.deepEqual(replacementFailure.getMeta(), oldMeta);
  assert.deepEqual(replacementFailure.getState(), local);
  assert.equal(replacementFailure.applied.length, 0);
  assert.equal(replacementFailure.statuses.some((status) => status.phase === 'saved'), false);
});

test('successful recovery archives before replacing metadata and applying the new lineage', async () => {
  const local = submit(makeInitialState(), 'old-link-success');
  const oldMeta = metaFor(local, { spaceId: '44444444-4444-4444-8444-444444444441' });
  const remote = submit(makeInitialState(), 'new-link-success');
  const payload = toCloudPayload(remote);
  const payloadHash = await sha256Hex(payload);
  const replacementSpace = '44444444-4444-4444-8444-444444444448';
  const order = [];
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async (spaceId) => {
      order.push('pull');
      return { status: 'ok', spaceId, generation: remote.progress.generation, version: 1, payload, payloadHash, updatedAt: '2026-10-03T15:00:00.000Z' };
    },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => ({
      status: 'ok', spaceId: replacementSpace, generation: remote.progress.generation,
      version: 1, payload, payloadHash, updatedAt: '2026-10-03T15:00:00.000Z',
    }),
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({
    state: local,
    meta: structuredClone(oldMeta),
    transport,
    archiveMeta: () => { order.push('archive'); return true; },
    writeMeta: (next, store) => { order.push('replace'); store.set(next); return true; },
  });
  const result = await fixture.engine.recover(generateRecoveryCode(), () => true);
  fixture.engine.stop();
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(order.slice(0, 2), ['archive', 'replace']);
  assert.equal(fixture.getMeta().spaceId, replacementSpace);
  assert.equal(fixture.getState().entries.some((entry) => entry.id === 'new-link-success'), true);
});

test('stop during a delayed recovery claim makes the continuation a no-op', async () => {
  const remote = submit(makeInitialState(), 'stopped-recovery');
  const payload = toCloudPayload(remote);
  const claim = deferred();
  let claimStarted = false;
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async () => { throw new Error('unexpected'); },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => { claimStarted = true; return claim.promise; },
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: makeInitialState(), transport });
  const recovering = fixture.engine.recover(generateRecoveryCode(), () => true);
  await waitFor(() => claimStarted, 'claim start');
  fixture.engine.stop();
  claim.resolve({
    status: 'ok', spaceId: '55555555-5555-4555-8555-555555555555', generation: remote.progress.generation,
    version: 1, payload, payloadHash: await sha256Hex(payload), updatedAt: '2026-10-03T15:00:00.000Z',
  });
  assert.deepEqual(await recovering, { ok: false, reason: 'error' });
  assert.equal(fixture.applied.length, 0);
  assert.equal(fixture.getMeta(), null);
  assert.equal(fixture.statuses.some((status) => status.phase === 'saved'), false);
});

test('a sync requested during recovery runs once after the adopted history is durable', async () => {
  const remote = submit(makeInitialState(), 'queued-after-recovery');
  const payload = toCloudPayload(remote);
  const payloadHash = await sha256Hex(payload);
  const claim = deferred();
  let pulls = 0;
  const transport = {
    createSpace: async () => { throw new Error('unexpected'); },
    pull: async (spaceId) => {
      pulls += 1;
      return { status: 'ok', spaceId, generation: remote.progress.generation, version: 1, payload, payloadHash, updatedAt: '2026-10-03T15:00:00.000Z' };
    },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => claim.promise,
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: makeInitialState(), transport });
  const recovery = fixture.engine.recover(generateRecoveryCode(), () => true);
  const queued = fixture.engine.requestSync();
  claim.resolve({
    status: 'ok', spaceId: '66666666-6666-4666-8666-666666666666', generation: remote.progress.generation,
    version: 1, payload, payloadHash, updatedAt: '2026-10-03T15:00:00.000Z',
  });
  assert.deepEqual(await recovery, { ok: true });
  await queued;
  await waitFor(() => pulls === 1, 'queued pull');
  assert.equal(pulls, 1);
  fixture.engine.stop();
});

test('stop during a delayed payload digest cannot mutate metadata or emit saved', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const nativeCrypto = globalThis.crypto;
  const digestGate = deferred();
  let digestStarted = false;
  const cryptoStub = {
    getRandomValues: nativeCrypto.getRandomValues.bind(nativeCrypto),
    subtle: {
      digest: async (...args) => {
        digestStarted = true;
        await digestGate.promise;
        return nativeCrypto.subtle.digest(...args);
      },
    },
  };
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: cryptoStub });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
  });

  const calls = [];
  const transport = {
    createSpace: async (input) => { calls.push(input); throw new Error('unexpected'); },
    pull: async () => { throw new Error('unexpected'); },
    syncSpace: async () => { throw new Error('unexpected'); },
    claimSpace: async () => ({ status: 'invalid' }),
    onAuthChange: () => () => undefined,
  };
  const fixture = makeEngine({ state: submit(makeInitialState(), 'digest-stop'), transport });
  const run = fixture.engine.requestSync();
  await waitFor(() => digestStarted, 'digest start');
  fixture.engine.stop();
  digestGate.resolve();
  await run;
  assert.equal(calls.length, 0);
  assert.equal(fixture.getMeta(), null);
  assert.equal(fixture.statuses.some((status) => status.phase === 'saved'), false);
});
