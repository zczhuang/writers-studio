import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; tone: 'info' | 'warn' | 'success' };

let counter = 0;
const listeners = new Set<(t: Toast) => void>();

export function pushToast(text: string, tone: Toast['tone'] = 'info') {
  const t: Toast = { id: ++counter, text, tone };
  listeners.forEach((l) => l(t));
}

export function useToastQueue(): Toast[] {
  const [queue, setQueue] = useState<Toast[]>([]);
  useEffect(() => {
    const handler = (t: Toast) => {
      setQueue((q) => [...q, t]);
      window.setTimeout(() => setQueue((q) => q.filter((x) => x.id !== t.id)), 3400);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);
  return queue;
}
