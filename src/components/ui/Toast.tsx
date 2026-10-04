import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useToastQueue } from '../../hooks/useToast';

export function ToastHost() {
  const queue = useToastQueue();
  return (
    <div className="ws-toasts" role="status" aria-live="polite">
      {queue.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'warn' ? AlertTriangle : Info;
        return (
          <div key={toast.id} className={`ws-toast is-${toast.tone}`}>
            <Icon size={18} aria-hidden="true" />
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
