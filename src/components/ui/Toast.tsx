import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useToastQueue } from '../../hooks/useToast';

export function ToastHost() {
  const queue = useToastQueue();
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
      {queue.map((t) => {
        const tone = t.tone === 'success' ? 'bg-moss/95 text-paper' : t.tone === 'warn' ? 'bg-rust/95 text-paper' : 'bg-surface-2/95 text-text border border-white/10';
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'warn' ? AlertTriangle : Info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 flex items-center gap-3 text-caption font-medium shadow-card animate-slide-up ${tone}`}
          >
            <Icon size={18} />
            <span className="flex-1">{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}
