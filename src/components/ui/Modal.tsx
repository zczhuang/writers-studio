import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Small line above the title, e.g. the world name. */
  eyebrow?: ReactNode;
  children: ReactNode;
  showClose?: boolean;
}

export function Modal({ open, onClose, title, eyebrow, children, showClose = true }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="ws-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || showClose) && (
          <div className="ws-modal-head">
            <div className="min-w-0">
              {eyebrow && <div className="ws-kicker">{eyebrow}</div>}
              {title ? <h2 id={titleId}>{title}</h2> : <span />}
            </div>
            {showClose && (
              <button type="button" onClick={onClose} className="ws-modal-close" aria-label="Close">
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="ws-modal-body">{children}</div>
      </div>
    </div>
  );
}
