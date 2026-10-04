import assert from 'node:assert/strict';
import test from 'node:test';

import { CloudSetupRequiredError, MissingCloudSessionError, ensureTransportSession } from '../src/cloud/transport.ts';

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


test('disabled anonymous sign-ins surface as a setup error, not a generic failure', async () => {
  const auth = {
    async getSession() { return { data: { session: null }, error: null }; },
    async signInAnonymously() {
      return { error: { name: 'AuthApiError', status: 422, code: 'anonymous_provider_disabled', message: 'Anonymous sign-ins are disabled' } };
    },
  };
  await assert.rejects(
    ensureTransportSession({}, auth, true),
    (error) => error instanceof CloudSetupRequiredError,
  );
});

test('a dead stored sign-in is replaced only where bootstrapping is allowed', async () => {
  let signCalls = 0;
  const auth = {
    async getSession() {
      return { data: { session: null }, error: { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found', message: 'Invalid Refresh Token' } };
    },
    async signInAnonymously() { signCalls += 1; return { error: null }; },
  };

  await assert.rejects(
    ensureTransportSession({}, auth, false),
    (error) => error instanceof MissingCloudSessionError,
  );
  assert.equal(signCalls, 0);

  await ensureTransportSession({}, auth, true);
  assert.equal(signCalls, 1);
});

test('other session read failures still stop the request', async () => {
  const auth = {
    async getSession() { return { data: { session: null }, error: new Error('storage unavailable') }; },
    async signInAnonymously() { throw new Error('should not sign in'); },
  };
  await assert.rejects(ensureTransportSession({}, auth, true), /storage unavailable/);
});
