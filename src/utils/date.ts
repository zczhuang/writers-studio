export function todayISO(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isoFromTimestamp(ms: number): string {
  return todayISO(new Date(ms));
}

export function isSameDay(a: number | string, b: number | string): boolean {
  const aISO = typeof a === 'number' ? isoFromTimestamp(a) : a;
  const bISO = typeof b === 'number' ? isoFromTimestamp(b) : b;
  return aISO === bISO;
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function prettyDate(d: number | string): string {
  const date = typeof d === 'number' ? new Date(d) : new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
