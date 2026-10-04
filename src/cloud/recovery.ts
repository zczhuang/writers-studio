import { uuid } from '../utils/id';
import { stableStringify } from '../utils/stable';

export const CLOUD_META_KEY = 'ws_cloud_meta_v1';
export const CLOUD_ARCHIVE_KEY = 'ws_cloud_archives_v1';

export interface PendingCloudOperation {
  id: string;
  payloadHash: string;
  kind: 'create' | 'sync';
}

export interface CloudLocalMeta {
  schema: 1;
  lineageId: string;
  generation: string;
  spaceId: string | null;
  serverVersion: number;
  recoveryCode: string | null;
  lastSavedAt: string | null;
  lastPayloadHash: string | null;
  pending: PendingCloudOperation | null;
}

const RECOVERY_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function normalizeRecoveryCode(value: string): string {
  return value.replace(/\s/g, '');
}

export function isRecoveryCode(value: string): boolean {
  return RECOVERY_CODE_PATTERN.test(normalizeRecoveryCode(value));
}

export function formatRecoveryCode(value: string): string {
  return normalizeRecoveryCode(value).match(/.{1,4}/g)?.join(' ') ?? value;
}

function parseMeta(raw: string | null): CloudLocalMeta | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CloudLocalMeta>;
    if (
      value.schema !== 1 ||
      typeof value.lineageId !== 'string' ||
      typeof value.generation !== 'string' ||
      (value.spaceId !== null && typeof value.spaceId !== 'string')
    ) return null;
    return {
      schema: 1,
      lineageId: value.lineageId,
      generation: value.generation,
      spaceId: value.spaceId,
      serverVersion: typeof value.serverVersion === 'number' && Number.isFinite(value.serverVersion) ? value.serverVersion : 0,
      recoveryCode: typeof value.recoveryCode === 'string' ? value.recoveryCode : null,
      lastSavedAt: typeof value.lastSavedAt === 'string' ? value.lastSavedAt : null,
      lastPayloadHash: typeof value.lastPayloadHash === 'string' ? value.lastPayloadHash : null,
      pending:
        value.pending &&
        typeof value.pending.id === 'string' &&
        typeof value.pending.payloadHash === 'string' &&
        (value.pending.kind === 'create' || value.pending.kind === 'sync')
          ? value.pending
          : null,
    };
  } catch {
    return null;
  }
}

export function readCloudMeta(): CloudLocalMeta | null {
  try {
    return parseMeta(localStorage.getItem(CLOUD_META_KEY));
  } catch {
    return null;
  }
}

export function writeCloudMeta(meta: CloudLocalMeta): boolean {
  let previous: string | null = null;
  let previousRead = false;
  try {
    previous = localStorage.getItem(CLOUD_META_KEY);
    previousRead = true;
    const previousMeta = parseMeta(previous);
    if (previousMeta && stableStringify(previousMeta) === stableStringify(meta)) return true;
    const serialized = JSON.stringify(meta);
    localStorage.setItem(CLOUD_META_KEY, serialized);
    if (localStorage.getItem(CLOUD_META_KEY) !== serialized) throw new Error('Cloud metadata readback did not match.');
    const readback = readCloudMeta();
    if (readback === null || stableStringify(readback) !== stableStringify(meta)) {
      throw new Error('Cloud metadata semantic readback did not match.');
    }
    return true;
  } catch (error) {
    // A storage adapter may partially apply a write before reporting failure.
    // Restore the exact prior bytes so the only recovery code is never replaced.
    if (previousRead) {
      try {
        if (previous === null) localStorage.removeItem(CLOUD_META_KEY);
        else localStorage.setItem(CLOUD_META_KEY, previous);
      } catch (restoreError) {
        console.warn('prior cloud metadata could not be restored', restoreError);
      }
    }
    console.warn('cloud metadata could not be saved', error);
    return false;
  }
}

export function metaForLineage(lineageId: string, generation: string): CloudLocalMeta {
  const existing = readCloudMeta();
  if (existing?.lineageId === lineageId && existing.generation === generation) return existing;
  return {
    schema: 1,
    lineageId,
    generation,
    spaceId: null,
    serverVersion: 0,
    recoveryCode: null,
    lastSavedAt: null,
    lastPayloadHash: null,
    pending: null,
  };
}

export function archiveAndDetachCloudMeta(metaToArchive?: CloudLocalMeta): boolean {
  let activeRaw: string | null = null;
  try {
    activeRaw = metaToArchive ? null : localStorage.getItem(CLOUD_META_KEY);
    const current = metaToArchive ?? parseMeta(activeRaw);
    if (!metaToArchive && activeRaw !== null && !current) return false;
    if (current) {
      const rawArchives = localStorage.getItem(CLOUD_ARCHIVE_KEY);
      const parsed = rawArchives ? JSON.parse(rawArchives) as unknown : [];
      if (!Array.isArray(parsed)) return false;
      const archives = parsed as CloudLocalMeta[];
      if (!archives.some((item) => stableStringify(item) === stableStringify(current))) {
        archives.push(current);
        const serialized = JSON.stringify(archives);
        localStorage.setItem(CLOUD_ARCHIVE_KEY, serialized);
        if (localStorage.getItem(CLOUD_ARCHIVE_KEY) !== serialized) return false;
        const archiveReadback = JSON.parse(localStorage.getItem(CLOUD_ARCHIVE_KEY) ?? 'null') as unknown;
        if (!Array.isArray(archiveReadback) || !archiveReadback.some((item) => stableStringify(item) === stableStringify(current))) {
          return false;
        }
      }
    }
    if (!metaToArchive) {
      localStorage.removeItem(CLOUD_META_KEY);
      if (localStorage.getItem(CLOUD_META_KEY) !== null) return false;
    }
    return true;
  } catch (error) {
    if (!metaToArchive && activeRaw !== null) {
      try {
        if (localStorage.getItem(CLOUD_META_KEY) !== activeRaw) localStorage.setItem(CLOUD_META_KEY, activeRaw);
      } catch (restoreError) {
        console.warn('active cloud lineage metadata could not be restored', restoreError);
      }
    }
    console.warn('cloud lineage metadata could not be archived', error);
    return false;
  }
}

/** Archive must succeed before reset invalidates sync or clears local history. */
export function archiveCloudMetaBeforeNewLineage(
  invalidate: () => void,
  archive: () => boolean = archiveAndDetachCloudMeta,
): boolean {
  if (!archive()) return false;
  invalidate();
  return true;
}

export function operationForPayload(
  meta: CloudLocalMeta,
  payloadHash: string,
  kind: PendingCloudOperation['kind'],
): PendingCloudOperation {
  if (meta.pending?.payloadHash === payloadHash && meta.pending.kind === kind) return meta.pending;
  return { id: uuid(), payloadHash, kind };
}
