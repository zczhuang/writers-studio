import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showClose?: boolean;
}

export function Modal({ open, onClose, title, children, showClose = true }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-bg/70 backdrop-blur-sm p-5 animate-fade-in">
      <div className="bg-surface border border-white/8 rounded-2xl shadow-card max-w-md w-full max-h-[88vh] overflow-y-auto animate-slide-up">
        {(title || showClose) && (
          <div className="flex items-center justify-between p-5 border-b border-white/8">
            {title ? <h2 className="font-display text-h2 font-semibold text-text">{title}</h2> : <span />}
            {showClose && (
              <button onClick={onClose} className="text-text-muted hover:text-text transition-colors p-1 -mr-1" aria-label="Close">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
