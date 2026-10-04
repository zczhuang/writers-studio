import assert from 'node:assert/strict';
import test from 'node:test';

import { MissingCloudSessionError, ensureTransportSession } from '../src/cloud/transport.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('anonymous session bootstrap is one shared flight for concurrent transport wrappers', async () => {
  const identity = {};
  const sessionRead = deferred();
  let getCalls = 0;
  let signCalls = 0;
  let session = null;
  const auth = {
    async getSession() {
      getCalls += 1;
      if (getCalls === 1) await sessionRead.promise;
      return { data: { session }, error: null };
    },
    async signInAnonymously() {
      signCalls += 1;
      session = { user: { id: 'anonymous-one' } };
      return { error: null };
    },
  };

  const first = ensureTransportSession(identity, auth, true);
  const second = ensureTransportSession(identity, auth, true);
  sessionRead.resolve();
  await Promise.all([first, second]);
  assert.equal(getCalls, 1);
  assert.equal(signCalls, 1);
});

test('failed session initialization clears the shared flight for a deterministic retry', async () => {
  const identity = {};
  let attempts = 0;
  let session = null;
  const auth = {
    async getSession() { return { data: { session }, error: null }; },
    async signInAnonymously() {
      attempts += 1;
      if (attempts === 1) return { error: new Error('temporary auth failure') };
      session = { user: { id: 'anonymous-retry' } };
      return { error: null };
    },
  };

  await assert.rejects(ensureTransportSession(identity, auth, true), /temporary auth failure/);
  await ensureTransportSession(identity, auth, true);
  assert.equal(attempts, 2);
});

test('existing remote pull or sync cannot silently mint a new anonymous identity', async () => {
  const identity = {};
  let signCalls = 0;
  const auth = {
    async getSession() { return { data: { session: null }, error: null }; },
    async signInAnonymously() { signCalls += 1; return { error: null }; },
  };

  await assert.rejects(
    ensureTransportSession(identity, auth, false),
    (error) => error instanceof MissingCloudSessionError,
  );
  assert.equal(signCalls, 0);
});
