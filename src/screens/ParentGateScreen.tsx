import { useRef, useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { PinPad } from '../components/ui/PinPad';
import { verifyPin } from '../services/pinHash';
import { Button } from '../components/ui/Button';

const PARENT_UNLOCK_MS = 10 * 60 * 1000;

export function ParentGateScreen() {
  const { state, dispatch } = useApp();
  const [shake, setShake] = useState(0);
  const [error, setError] = useState('');
  const attempts = useRef(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  const lockedRemainingSec = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));

  const submit = async (pin: string) => {
    if (lockedRemainingSec > 0) return;
    const ok = await verifyPin(pin, state.settings.parentPinSalt, state.settings.parentPinHash ?? '');
    if (ok) {
      attempts.current = 0;
      setError('');
      const target = state.parentGateTarget ?? 'parent-dashboard';
      dispatch({ type: 'UNLOCK_PARENT', untilMs: Date.now() + PARENT_UNLOCK_MS });
      dispatch({ type: 'NAV_RESET', screen: target });
    } else {
      attempts.current += 1;
      setShake((s) => s + 1);
      if (attempts.current >= 3) {
        setLockedUntil(Date.now() + 30_000);
        setError('Too many wrong PINs. Wait 30s.');
        attempts.current = 0;
      } else {
        setError(`Wrong PIN — ${3 - attempts.current} ${3 - attempts.current === 1 ? 'try' : 'tries'} left.`);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-slide-up">
      <div className="bg-gold/15 text-gold rounded-full p-3 mb-3">
        <ShieldCheck size={26} />
      </div>
      <h1 className="font-display text-h1 font-semibold text-text mb-1 text-center">Parent PIN</h1>
      <p className="text-caption text-text-muted mb-6 text-center max-w-xs">
        Four digits unlock payouts and settings.
      </p>

      {lockedRemainingSec > 0 ? (
        <div className="bg-rust/15 text-text border border-rust/30 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-rust" />
          <span>Locked for {lockedRemainingSec}s</span>
        </div>
      ) : null}

      <PinPad onSubmit={submit} shake={shake > 0 && shake % 2 === 1 ? true : false} />

      {error && lockedRemainingSec === 0 && (
        <p className="mt-3 text-caption text-rust">{error}</p>
      )}

      <Button variant="ghost" onClick={() => dispatch({ type: 'NAV_BACK' })} className="mt-6" size="sm">
        Cancel
      </Button>
    </div>
  );
}
