import { useState, useRef, useEffect } from 'react';
import { Delete } from 'lucide-react';

interface Props {
  onSubmit: (pin: string) => void | Promise<void>;
  length?: number;
  shake?: boolean;
}

export function PinPad({ onSubmit, length = 4, shake = false }: Props) {
  const [pin, setPin] = useState('');
  const [bumping, setBumping] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    setPin('');
  }, [shake]);

  useEffect(() => {
    if (pin.length === length && !submitting.current) {
      submitting.current = true;
      Promise.resolve(onSubmit(pin)).finally(() => {
        submitting.current = false;
      });
    }
  }, [pin, length, onSubmit]);

  const tap = (digit: string) => {
    setPin((p) => (p.length < length ? p + digit : p));
    setBumping(true);
    window.setTimeout(() => setBumping(false), 80);
  };
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className={shake ? 'animate-shake' : ''}>
      <div className="flex justify-center gap-3 mb-6">
        {Array.from({ length }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <span
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-colors ${filled ? 'bg-gold' : 'bg-surface-2 border border-white/15'} ${bumping && i === pin.length - 1 ? 'scale-110' : ''}`}
              style={{ transition: 'transform 80ms ease' }}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {[1,2,3,4,5,6,7,8,9].map((n) => (
          <button
            key={n}
            onClick={() => tap(String(n))}
            className="bg-surface-2 hover:bg-surface text-text font-display text-h1 font-semibold py-3 rounded-xl border border-white/8 active:scale-95 transition-transform"
          >
            {n}
          </button>
        ))}
        <span />
        <button
          onClick={() => tap('0')}
          className="bg-surface-2 hover:bg-surface text-text font-display text-h1 font-semibold py-3 rounded-xl border border-white/8 active:scale-95 transition-transform"
        >
          0
        </button>
        <button
          onClick={back}
          className="bg-surface-2 hover:bg-surface text-text-muted py-3 rounded-xl border border-white/8 active:scale-95 transition-transform flex items-center justify-center"
          aria-label="Backspace"
        >
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}
