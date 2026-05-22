import { useEffect, useRef, useState } from 'react';
import { DRAFT_PREFIX } from '../state/initialState';

const TTL_MS = 7 * 86_400_000;

export function useDraft(key: string | null): [string, (v: string) => void, () => void] {
  const [value, setValue] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + key);
      if (!raw) { setValue(''); return; }
      const parsed = JSON.parse(raw);
      if (Date.now() - (parsed.savedAt ?? 0) > TTL_MS) {
        localStorage.removeItem(DRAFT_PREFIX + key);
        setValue('');
        return;
      }
      setValue(parsed.text ?? '');
    } catch {
      setValue('');
    }
  }, [key]);

  const update = (v: string) => {
    setValue(v);
    if (!key) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ text: v, savedAt: Date.now() }));
      } catch { /* ignore */ }
    }, 400);
  };

  const clear = () => {
    if (key) try { localStorage.removeItem(DRAFT_PREFIX + key); } catch { /* ignore */ }
    setValue('');
  };

  return [value, update, clear];
}
