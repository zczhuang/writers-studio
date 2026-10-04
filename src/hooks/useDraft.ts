import { useEffect, useRef, useState } from 'react';
import { DRAFT_PREFIX } from '../state/initialState';

const TTL_MS = 7 * 86_400_000;

function readDraft(key: string | null): string {
  if (!key) return '';
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { text?: unknown; savedAt?: unknown };
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0;
    if (Date.now() - savedAt > TTL_MS) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return '';
    }
    return typeof parsed.text === 'string' ? parsed.text : '';
  } catch {
    return '';
  }
}

export function useDraft(key: string | null): [string, (v: string) => void, () => void] {
  const [value, setValue] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const nextValue = readDraft(key);
    queueMicrotask(() => {
      if (active) setValue(nextValue);
    });
    return () => {
      active = false;
    };
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
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (key) try { localStorage.removeItem(DRAFT_PREFIX + key); } catch { /* ignore */ }
    setValue('');
  };

  return [value, update, clear];
}
