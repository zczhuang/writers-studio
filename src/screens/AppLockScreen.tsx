import { useState } from 'react';
import { Lock, Feather } from 'lucide-react';
import { PinPad } from '../components/ui/PinPad';
import { hashPin } from '../services/pinHash';

const APP_PIN_HASH = 'a5396c5cbdfad7f0c4a9b763830d0d0742d49c39eeb32ab64a8f02627fd8df0f'; // sha256('0717')
const APP_PIN_SALT = ''; // no salt — keeps the hash a stable build-time constant

export const APP_UNLOCK_KEY = 'ws_app_unlocked_v1';

export function AppLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [shake, setShake] = useState(0);
  const [error, setError] = useState('');

  const submit = async (pin: string) => {
    const got = await hashPin(pin, APP_PIN_SALT);
    if (got === APP_PIN_HASH) {
      try { localStorage.setItem(APP_UNLOCK_KEY, '1'); } catch { /* ignore */ }
      setError('');
      onUnlock();
    } else {
      setShake((s) => s + 1);
      setError("That's not the PIN.");
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-5 py-12 animate-fade-in">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/15 text-gold">
          <Feather size={26} />
        </div>
        <div>
          <h1 className="font-display text-display font-semibold text-text leading-tight">Writer's Studio</h1>
          <p className="font-serif italic text-text-muted mt-2 flex items-center justify-center gap-1.5">
            <Lock size={13} className="text-gold/80" /> Enter access PIN to continue
          </p>
        </div>
        <PinPad onSubmit={submit} shake={shake > 0 && shake % 2 === 1 ? true : false} />
        {error && <p className="text-caption text-rust">{error}</p>}
      </div>
    </div>
  );
}
