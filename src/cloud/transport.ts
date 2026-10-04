import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CloudPayload, EntryVersionUpload } from './model';
import { stableStringify } from '../utils/stable';

export interface CloudHead {
  status: 'ok';
  spaceId: string;
  generation: string;
  version: number;
  payload: unknown;
  payloadHash: string;
  updatedAt: string;
}

export interface CloudMutationResult {
  status: 'ok' | 'conflict' | 'empty_rejected' | 'invalid' | 'rate_limited' | 'forbidden';
  spaceId?: string;
  generation?: string;
  version?: number;
  payload?: unknown;
  payloadHash?: string;
  updatedAt?: string;
  retryAfterSeconds?: number;
}

export interface CreateSpaceInput {
  lineageId: string;
  generation: string;
  recoveryCode: string;
  operationId: string;
  payload: CloudPayload;
  payloadHash: string;
  entryVersions: EntryVersionUpload[];
}

export interface SyncSpaceInput {
  spaceId: string;
  generation: string;
  expectedVersion: number;
  operationId: string;
  payload: CloudPayload;
  payloadHash: string;
  entryVersions: EntryVersionUpload[];
}

export interface CloudTransport {
  createSpace(input: CreateSpaceInput): Promise<CloudMutationResult>;
  pull(spaceId: string): Promise<CloudHead>;
  syncSpace(input: SyncSpaceInput): Promise<CloudMutationResult>;
  claimSpace(recoveryCode: string): Promise<CloudMutationResult>;
  onAuthChange(callback: () => void): () => void;
}

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export function readSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

let singleton: SupabaseClient | null = null;
let singletonKey = '';
const sessionInitializations = new WeakMap<object, Promise<void>>();

export class MissingCloudSessionError extends Error {
  constructor() {
    super('The existing cloud history is not signed in on this device. Use its recovery code.');
    this.name = 'MissingCloudSessionError';
  }
}

export interface SessionAuthAdapter {
  getSession(): Promise<{ data: { session: unknown | null }; error: unknown | null }>;
  signInAnonymously(): Promise<{ error: unknown | null }>;
}

/** Shared by every transport wrapper around the same singleton client. */
export function ensureTransportSession(
  identity: object,
  auth: SessionAuthAdapter,
  allowAnonymousBootstrap: boolean,
): Promise<void> {
  const active = sessionInitializations.get(identity);
  if (active) return active;
  const initialization = (async () => {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    if (data.session) return;
    if (!allowAnonymousBootstrap) throw new MissingCloudSessionError();
    const signedIn = await auth.signInAnonymously();
    if (signedIn.error) throw signedIn.error;
  })();
  sessionInitializations.set(identity, initialization);
  void initialization.finally(() => {
    if (sessionInitializations.get(identity) === initialization) sessionInitializations.delete(identity);
  }).catch(() => undefined);
  return initialization;
}

function clientFor(config: SupabaseConfig): SupabaseClient {
  const key = `${config.url}|${config.publishableKey}`;
  if (!singleton || singletonKey !== key) {
    singleton = createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'writers-studio-supabase-auth-v1',
      },
    });
    singletonKey = key;
  }
  return singleton;
}

function rpcObject(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}

function parseMutation(data: unknown): CloudMutationResult {
  const row = rpcObject(data);
  const status = typeof row.status === 'string' ? row.status : 'invalid';
  return {
    status:
      status === 'ok' || status === 'conflict' || status === 'empty_rejected' || status === 'rate_limited' || status === 'forbidden'
        ? status
        : 'invalid',
    spaceId: typeof row.space_id === 'string' ? row.space_id : undefined,
    generation: typeof row.generation === 'string' ? row.generation : undefined,
    version: typeof row.version === 'number' ? row.version : undefined,
    payload: row.payload,
    payloadHash: typeof row.payload_hash === 'string' ? row.payload_hash : undefined,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    retryAfterSeconds: typeof row.retry_after_seconds === 'number' ? row.retry_after_seconds : undefined,
  };
}

export function createSupabaseTransport(config: SupabaseConfig): CloudTransport {
  const client = clientFor(config);

  const rpc = async (name: string, args: Record<string, unknown>, allowAnonymousBootstrap: boolean): Promise<unknown> => {
    await ensureTransportSession(client, client.auth, allowAnonymousBootstrap);
    const result = await client.rpc(name, args);
    if (!result.error) return result.data;
    // A stale/expired device token gets one refresh attempt. Local data is never changed here.
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw result.error;
    const retry = await client.rpc(name, args);
    if (retry.error) throw retry.error;
    return retry.data;
  };

  return {
    async createSpace(input) {
      const data = await rpc('create_writer_space', {
        p_lineage_id: input.lineageId,
        p_generation: input.generation,
        p_recovery_code: input.recoveryCode,
        p_operation_id: input.operationId,
        p_payload: input.payload,
        p_payload_hash: input.payloadHash,
        p_entry_versions: input.entryVersions,
        p_payload_canonical: stableStringify(input.payload),
      }, true);
      return parseMutation(data);
    },

    async pull(spaceId) {
      const data = await rpc('get_writer_space_state', { p_space_id: spaceId }, false);
      const row = rpcObject(data);
      if (row.status !== 'ok') throw new Error('Cloud history is not available for this device.');
      if (
        typeof row.space_id !== 'string' ||
        typeof row.generation !== 'string' ||
        typeof row.version !== 'number' ||
        typeof row.payload_hash !== 'string' ||
        typeof row.updated_at !== 'string'
      ) throw new Error('Cloud history returned an incomplete response.');
      return {
        status: 'ok',
        spaceId: row.space_id,
        generation: row.generation,
        version: row.version,
        payload: row.payload,
        payloadHash: row.payload_hash,
        updatedAt: row.updated_at,
      };
    },

    async syncSpace(input) {
      const data = await rpc('sync_writer_space', {
        p_space_id: input.spaceId,
        p_generation: input.generation,
        p_expected_version: input.expectedVersion,
        p_operation_id: input.operationId,
        p_payload: input.payload,
        p_payload_hash: input.payloadHash,
        p_entry_versions: input.entryVersions,
        p_payload_canonical: stableStringify(input.payload),
      }, false);
      return parseMutation(data);
    },

    async claimSpace(recoveryCode) {
      const data = await rpc('claim_writer_space', { p_recovery_code: recoveryCode }, true);
      return parseMutation(data);
    },

    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') callback();
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
