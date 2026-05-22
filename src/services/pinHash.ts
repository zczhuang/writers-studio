function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function makeSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return toHex(buf);
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  if (!salt || !hash) return false;
  const calc = await hashPin(pin, salt);
  return calc === hash;
}
