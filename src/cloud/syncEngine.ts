import type { AppState } from '../types';
import { hasMeaningfulProgress } from '../state/normalization';
import { sha256Hex, stableStringify } from '../utils/stable';
import { cloudPayloadToState, entryVersionUploads, mergeAppStates, toCloudPayload, type CloudPayload } from './model';
import type { CloudTransport } from './transport';
import {
  generateRecoveryCode,
  normalizeRecoveryCode,
  operationForPayload,
  type CloudLocalMeta,
} from './recovery';

export type CloudPhase = 'unavailable' | 'device-only' | 'offline' | 'connecting' | 'saving' | 'saved' | 'error';

export interface CloudStatus {
  phase: CloudPhase;
  message: string;
  lastSavedAt: string | null;
}

export type RecoveryResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'rate_limited' | 'expired' | 'unavailable' | 'error'; retryAfterSeconds?: number };

export interface SyncEngineOptions {
  transport: CloudTransport | null;
  getState: () => AppState;
  applyState: (state: AppState) => void;
  getMeta: () => CloudLocalMeta | null;
  setMeta: (meta: CloudLocalMeta) => boolean;
  archiveCurrentMeta?: (meta?: CloudLocalMeta) => boolean;
  isOnline: () => boolean;
  onStatus: (status: CloudStatus) => void;
  nowIso?: () => string;
}

const DEVICE_ONLY: CloudStatus = {
  phase: 'device-only',
  message: 'Cloud backup is waiting for writing',
  lastSavedAt: null,
};

class MetadataDurabilityError extends Error {
  constructor() {
    super('Cloud recovery metadata could not be saved and verified.');
    this.name = 'MetadataDurabilityError';
  }
}

export class SyncEngine {
  private readonly options: SyncEngineOptions;
  private running: Promise<void> | null = null;
  private recoveryRun: Promise<RecoveryResult> | null = null;
  private rerun = false;
  private fence = 0;
  private stopped = false;

  constructor(options: SyncEngineOptions) {
    this.options = options;
  }

  start(): void {
    this.stopped = false;
    if (!this.options.transport) {
      this.emit({ phase: 'unavailable', message: 'Cloud backup is not configured', lastSavedAt: null });
      return;
    }
    void this.requestSync();
  }

  stop(): void {
    this.stopped = true;
    this.fence += 1;
    this.rerun = false;
  }

  invalidate(): void {
    this.fence += 1;
    this.rerun = false;
    this.emit(DEVICE_ONLY);
  }

  requestSync(): Promise<void> {
    if (this.stopped || !this.options.transport) return Promise.resolve();
    if (this.recoveryRun) {
      this.rerun = true;
      return this.recoveryRun.then(() => undefined);
    }
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    const run = this.drain();
    const tracked = run.finally(() => {
      if (this.running === tracked) this.running = null;
    });
    this.running = tracked;
    return tracked;
  }

  private async drain(): Promise<void> {
    let passes = 0;
    do {
      this.rerun = false;
      await this.syncOnce();
      passes += 1;
      if (passes >= 4 && this.rerun) {
        this.rerun = false;
        this.emit({
          phase: 'error',
          message: 'Cloud save needs another try',
          lastSavedAt: this.options.getMeta()?.lastSavedAt ?? null,
        });
      }
    } while (this.rerun && !this.stopped && !this.recoveryRun);
  }

  private currentMeta(state: AppState): CloudLocalMeta {
    const saved = this.options.getMeta();
    if (saved?.lineageId === state.progress.lineageId && saved.generation === state.progress.generation) return saved;
    return {
      schema: 1,
      lineageId: state.progress.lineageId,
      generation: state.progress.generation,
      spaceId: null,
      serverVersion: 0,
      recoveryCode: null,
      lastSavedAt: null,
      lastPayloadHash: null,
      pending: null,
    };
  }

  private fenceMatches(fence: number, lineageId: string, generation: string): boolean {
    if (this.stopped || fence !== this.fence) return false;
    const current = this.options.getState().progress;
    return current.lineageId === lineageId && current.generation === generation;
  }

  private payloadMatches(canonicalPayload: string): boolean {
    return stableStringify(toCloudPayload(this.options.getState())) === canonicalPayload;
  }

  private storeMeta(meta: CloudLocalMeta, fence: number, lineageId: string, generation: string): void {
    if (!this.fenceMatches(fence, lineageId, generation)) throw new Error('Cloud lineage changed.');
    if (!this.options.setMeta(meta)) throw new MetadataDurabilityError();
  }

  private queueNewerPayload(fence: number, lineageId: string, generation: string, message: string, lastSavedAt: string | null): void {
    if (!this.fenceMatches(fence, lineageId, generation)) return;
    this.rerun = true;
    this.emit({ phase: 'saving', message, lastSavedAt });
  }

  private async capturePayload(
    state: AppState,
    fence: number,
    lineageId: string,
    generation: string,
  ): Promise<{ payload: CloudPayload; canonical: string; hash: string } | null> {
    const payload = toCloudPayload(state);
    const canonical = stableStringify(payload);
    const hash = await sha256Hex(canonical);
    if (!this.fenceMatches(fence, lineageId, generation)) return null;
    if (!this.payloadMatches(canonical)) {
      this.rerun = true;
      return null;
    }
    return { payload, canonical, hash };
  }

  private async syncOnce(): Promise<void> {
    const transport = this.options.transport;
    if (!transport || this.recoveryRun) return;
    const local = this.options.getState();
    const lineageId = local.progress.lineageId;
    const generation = local.progress.generation;
    const capturedFence = this.fence;
    let meta = this.currentMeta(local);

    if (!this.options.isOnline()) {
      if (this.fenceMatches(capturedFence, lineageId, generation)) {
        this.emit({ phase: 'offline', message: 'Offline · cloud not updated', lastSavedAt: meta.lastSavedAt });
      }
      return;
    }

    if (!meta.spaceId) {
      if (!hasMeaningfulProgress(local)) {
        if (this.fenceMatches(capturedFence, lineageId, generation)) this.emit(DEVICE_ONLY);
        return;
      }
      try {
        if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
        this.emit({ phase: 'connecting', message: 'Connecting cloud backup…', lastSavedAt: meta.lastSavedAt });
        const capture = await this.capturePayload(local, capturedFence, lineageId, generation);
        if (!capture) return;

        const sharedMeta = this.options.getMeta();
        if (sharedMeta?.lineageId === lineageId && sharedMeta.generation === generation) meta = sharedMeta;
        if (meta.spaceId) {
          this.queueNewerPayload(capturedFence, lineageId, generation, 'Cloud linked · checking changes…', meta.lastSavedAt);
          return;
        }
        const recoveryCode = meta.recoveryCode ?? generateRecoveryCode();
        const operation = operationForPayload(meta, capture.hash, 'create');
        meta = { ...meta, recoveryCode, pending: operation };
        this.storeMeta(meta, capturedFence, lineageId, generation);
        if (!this.fenceMatches(capturedFence, lineageId, generation) || !this.payloadMatches(capture.canonical)) {
          this.rerun = this.fenceMatches(capturedFence, lineageId, generation);
          return;
        }

        const result = await transport.createSpace({
          lineageId,
          generation,
          recoveryCode,
          operationId: operation.id,
          payload: capture.payload,
          payloadHash: capture.hash,
          entryVersions: entryVersionUploads(capture.payload),
        });
        if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
        const newest = this.payloadMatches(capture.canonical);
        if (
          result.status !== 'ok' || !result.spaceId || result.generation !== generation
          || result.version === undefined || !result.payloadHash
        ) throw new Error('Cloud space was not created.');

        const savedAt = result.updatedAt ?? this.nowIso();
        meta = {
          ...meta,
          spaceId: result.spaceId,
          serverVersion: result.version,
          lastSavedAt: savedAt,
          lastPayloadHash: result.payloadHash,
          pending: null,
        };
        this.storeMeta(meta, capturedFence, lineageId, generation);
        if (!newest || result.payloadHash !== capture.hash) {
          this.queueNewerPayload(capturedFence, lineageId, generation, 'Cloud linked · saving newer changes…', savedAt);
        } else if (this.fenceMatches(capturedFence, lineageId, generation)) {
          this.emit({ phase: 'saved', message: 'Cloud saved', lastSavedAt: savedAt });
        }
      } catch (error) {
        if (this.fenceMatches(capturedFence, lineageId, generation)) this.handleError(error, this.options.getMeta());
      }
      return;
    }

    try {
      if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
      this.emit({ phase: 'saving', message: 'Checking cloud backup…', lastSavedAt: meta.lastSavedAt });
      const head = await transport.pull(meta.spaceId);
      if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
      if (head.spaceId !== meta.spaceId || head.generation !== generation) throw new Error('Cloud lineage did not match this device.');
      const remote = cloudPayloadToState(head.payload);
      if (remote.progress.generation !== generation || remote.progress.lineageId !== lineageId) {
        throw new Error('Cloud history belongs to a different writing line.');
      }

      const latest = this.options.getState();
      const merged = mergeAppStates(latest, remote);
      if (stableStringify(toCloudPayload(merged)) !== stableStringify(toCloudPayload(latest))) {
        if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
        this.options.applyState(merged);
      }
      if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
      const capture = await this.capturePayload(this.options.getState(), capturedFence, lineageId, generation);
      if (!capture) return;

      if (capture.hash === head.payloadHash) {
        meta = {
          ...meta,
          serverVersion: head.version,
          lastSavedAt: head.updatedAt,
          lastPayloadHash: head.payloadHash,
          pending: null,
        };
        this.storeMeta(meta, capturedFence, lineageId, generation);
        if (this.payloadMatches(capture.canonical)) {
          this.emit({ phase: 'saved', message: 'Cloud saved', lastSavedAt: head.updatedAt });
        } else {
          this.rerun = true;
        }
        return;
      }

      const sharedMeta = this.options.getMeta();
      if (sharedMeta?.lineageId === lineageId && sharedMeta.generation === generation) meta = sharedMeta;
      const operation = operationForPayload(meta, capture.hash, 'sync');
      meta = { ...meta, serverVersion: head.version, pending: operation };
      this.storeMeta(meta, capturedFence, lineageId, generation);
      if (!this.fenceMatches(capturedFence, lineageId, generation) || !this.payloadMatches(capture.canonical)) {
        this.rerun = this.fenceMatches(capturedFence, lineageId, generation);
        return;
      }

      const result = await transport.syncSpace({
        spaceId: head.spaceId,
        generation,
        expectedVersion: head.version,
        operationId: operation.id,
        payload: capture.payload,
        payloadHash: capture.hash,
        entryVersions: entryVersionUploads(capture.payload),
      });
      if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
      const newest = this.payloadMatches(capture.canonical);

      if (result.status === 'conflict') {
        if (result.payload) {
          const conflictHead = cloudPayloadToState(result.payload);
          const current = this.options.getState();
          const conflictMerged = mergeAppStates(current, conflictHead);
          if (!this.fenceMatches(capturedFence, lineageId, generation)) return;
          this.options.applyState(conflictMerged);
        }
        meta = {
          ...meta,
          serverVersion: result.version ?? head.version,
          lastPayloadHash: result.payloadHash ?? head.payloadHash,
          pending: null,
        };
        this.storeMeta(meta, capturedFence, lineageId, generation);
        this.rerun = true;
        return;
      }
      if (result.status !== 'ok' || result.version === undefined) throw new Error('Cloud save was not accepted.');

      const savedAt = result.updatedAt ?? this.nowIso();
      meta = {
        ...meta,
        serverVersion: result.version,
        lastSavedAt: savedAt,
        lastPayloadHash: result.payloadHash ?? capture.hash,
        pending: null,
      };
      this.storeMeta(meta, capturedFence, lineageId, generation);
      if (newest && (result.payloadHash === undefined || result.payloadHash === capture.hash)) {
        this.emit({ phase: 'saved', message: 'Cloud saved', lastSavedAt: savedAt });
      } else {
        this.queueNewerPayload(capturedFence, lineageId, generation, 'Saving newer changes…', savedAt);
      }
    } catch (error) {
      if (this.fenceMatches(capturedFence, lineageId, generation)) this.handleError(error, this.options.getMeta());
    }
  }

  recover(recoveryCode: string, authorized: () => boolean): Promise<RecoveryResult> {
    if (this.recoveryRun) return this.recoveryRun;
    const run = this.recoverOnce(recoveryCode, authorized);
    const tracked = run.finally(() => {
      if (this.recoveryRun === tracked) this.recoveryRun = null;
      if (this.rerun && !this.stopped) {
        queueMicrotask(() => void this.requestSync());
      }
    });
    this.recoveryRun = tracked;
    return tracked;
  }

  private recoveryMatches(
    fence: number,
    lineageId: string,
    generation: string,
    authorized: () => boolean,
  ): boolean {
    return authorized() && this.fenceMatches(fence, lineageId, generation);
  }

  private async recoverOnce(recoveryCode: string, authorized: () => boolean): Promise<RecoveryResult> {
    const transport = this.options.transport;
    if (!transport) return { ok: false, reason: 'unavailable' };
    if (!authorized()) return { ok: false, reason: 'expired' };
    const code = normalizeRecoveryCode(recoveryCode);
    const starting = this.options.getState().progress;
    const hadRunningSync = this.running !== null;
    this.fence += 1;
    const recoveryFence = this.fence;
    this.rerun = hadRunningSync;
    const interrupted = this.running;
    if (interrupted) await interrupted;
    if (!this.recoveryMatches(recoveryFence, starting.lineageId, starting.generation, authorized)) {
      return { ok: false, reason: authorized() ? 'error' : 'expired' };
    }

    try {
      this.emit({ phase: 'connecting', message: 'Looking for writing history…', lastSavedAt: null });
      const result = await transport.claimSpace(code);
      if (!this.recoveryMatches(recoveryFence, starting.lineageId, starting.generation, authorized)) {
        return { ok: false, reason: authorized() ? 'error' : 'expired' };
      }
      if (result.status === 'rate_limited') {
        this.emit({ phase: 'error', message: 'Too many recovery attempts · try again later', lastSavedAt: null });
        return { ok: false, reason: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds };
      }
      if (result.status !== 'ok' || !result.spaceId || !result.generation || result.version === undefined || !result.payload) {
        this.emit({ phase: 'error', message: 'That recovery code did not match', lastSavedAt: null });
        return { ok: false, reason: 'invalid' };
      }

      const remote = cloudPayloadToState(result.payload);
      if (remote.progress.generation !== result.generation) throw new Error('Recovered history was incomplete.');
      const merged = mergeAppStates(this.options.getState(), remote, true);
      if (!this.recoveryMatches(recoveryFence, starting.lineageId, starting.generation, authorized)) {
        return { ok: false, reason: authorized() ? 'error' : 'expired' };
      }

      const existingMeta = this.options.getMeta();
      const nextMeta: CloudLocalMeta = {
        schema: 1,
        lineageId: remote.progress.lineageId,
        generation: remote.progress.generation,
        spaceId: result.spaceId,
        serverVersion: result.version,
        recoveryCode: code,
        lastSavedAt: result.updatedAt ?? null,
        lastPayloadHash: result.payloadHash ?? null,
        pending: null,
      };
      const replacesExistingLinkage = !!existingMeta
        && !!(existingMeta.spaceId || existingMeta.recoveryCode)
        && (
          existingMeta.lineageId !== nextMeta.lineageId
          || existingMeta.generation !== nextMeta.generation
          || existingMeta.spaceId !== nextMeta.spaceId
          || existingMeta.recoveryCode !== nextMeta.recoveryCode
        );
      if (replacesExistingLinkage) {
        if (!this.options.archiveCurrentMeta || !this.options.archiveCurrentMeta(existingMeta)) {
          throw new MetadataDurabilityError();
        }
      }
      if (!this.options.setMeta(nextMeta)) {
        if (existingMeta) this.options.setMeta(existingMeta);
        throw new MetadataDurabilityError();
      }
      if (!this.recoveryMatches(recoveryFence, starting.lineageId, starting.generation, authorized)) {
        if (existingMeta) this.options.setMeta(existingMeta);
        return { ok: false, reason: authorized() ? 'error' : 'expired' };
      }
      this.options.applyState(merged);
      const adopted = this.options.getState().progress;
      if (
        this.stopped || recoveryFence !== this.fence || !authorized()
        || adopted.lineageId !== remote.progress.lineageId || adopted.generation !== remote.progress.generation
      ) return { ok: false, reason: authorized() ? 'error' : 'expired' };

      this.emit({ phase: 'saving', message: 'History restored · checking for newer changes…', lastSavedAt: nextMeta.lastSavedAt });
      this.rerun = true;
      return { ok: true };
    } catch (error) {
      if (!authorized()) return { ok: false, reason: 'expired' };
      if (this.fenceMatches(recoveryFence, starting.lineageId, starting.generation)) {
        this.handleError(error, this.options.getMeta());
      }
      return { ok: false, reason: 'error' };
    }
  }

  private nowIso(): string {
    return this.options.nowIso?.() ?? new Date().toISOString();
  }

  private emit(status: CloudStatus): void {
    if (!this.stopped) this.options.onStatus(status);
  }

  private handleError(error: unknown, meta: CloudLocalMeta | null): void {
    console.warn('cloud sync failed; local state retained', error);
    if (!this.options.isOnline()) {
      this.emit({ phase: 'offline', message: 'Offline · cloud not updated', lastSavedAt: meta?.lastSavedAt ?? null });
      return;
    }
    this.emit({
      phase: 'error',
      message: error instanceof MetadataDurabilityError
        ? 'Cloud paused · recovery details could not be saved locally'
        : 'Cloud save needs another try',
      lastSavedAt: meta?.lastSavedAt ?? null,
    });
  }
}
