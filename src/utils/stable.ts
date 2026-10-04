function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const next = source[key];
    if (next !== undefined) out[key] = canonical(next);
  }
  return out;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonical(value));
}

/** Small deterministic identifier for local provenance/deduping; not a credential hash. */
export function stableId(value: unknown): string {
  const text = typeof value === 'string' ? value : stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function sha256Hex(value: unknown): Promise<string> {
  const text = typeof value === 'string' ? value : stableStringify(value);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
