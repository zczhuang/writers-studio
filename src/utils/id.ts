const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function id(len: number = 12): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHA[arr[i] % ALPHA.length];
  return out;
}
