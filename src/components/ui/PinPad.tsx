import { useState, useRef, useEffect } from 'react';
import { Delete } from 'lucide-react';

interface Props {
  onSubmit: (pin: string) => void | Promise<void>;
  length?: number;
  shake?: boolean;
  /** Accept digits and Backspace from a physical keyboard while mounted. */
  keyboard?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({ onSubmit, length = 4, shake = false, keyboard = true }: Props) {
  const [pinState, setPinState] = useState(() => ({ resetSignal: shake, value: '' }));
  const [bumping, setBumping] = useState(false);
  const submitting = useRef(false);
  const pin = pinState.resetSignal === shake ? pinState.value : '';

  const updatePin = (update: (current: string) => string) => {
    setPinState((current) => ({
      resetSignal: shake,
      value: update(current.resetSignal === shake ? current.value : ''),
    }));
  };

  useEffect(() => {
    if (pin.length === length && !submitting.current) {
      submitting.current = true;
      Promise.resolve(onSubmit(pin)).finally(() => {
        submitting.current = false;
      });
    }
  }, [pin, length, onSubmit]);

  const tap = (digit: string) => {
    updatePin((current) => (current.length < length ? current + digit : current));
    setBumping(true);
    window.setTimeout(() => setBumping(false), 90);
  };
  const back = () => updatePin((current) => current.slice(0, -1));

  const latest = useRef({ tap, back });
  useEffect(() => {
    latest.current = { tap, back };
  });

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        latest.current.tap(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        latest.current.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard]);

  return (
    <div className={shake ? 'animate-shake' : ''}>
      <div className="ws-pin-dots" aria-live="polite" aria-label={`${pin.length} of ${length} digits entered`} role="status">
        {Array.from({ length }).map((_, index) => {
          const filled = index < pin.length;
          return (
            <span
              key={index}
              className={`ws-pin-dot ${filled ? 'is-filled' : ''} ${bumping && index === pin.length - 1 ? 'is-bump' : ''}`}
            />
          );
        })}
      </div>
      <div className="ws-pinpad">
        {DIGITS.map((digit) => (
          <button key={digit} type="button" onClick={() => tap(digit)} className="ws-pin-key">
            {digit}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" onClick={() => tap('0')} className="ws-pin-key">
          0
        </button>
        <button type="button" onClick={back} className="ws-pin-key is-icon" aria-label="Backspace">
          <Delete size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
