import { useState } from 'react';
import { Lock } from 'lucide-react';
import { PinPad } from '../components/ui/PinPad';
import { hashPin } from '../services/pinHash';
import { HeroScene } from '../components/art/HeroScene';
import { StarField } from '../components/art/StarField';
import { BrandMark } from '../components/art/BrandMark';

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
      setError("That's not the PIN. Try again.");
    }
  };

  return (
    <div className="ws-stage">
      <StarField seed={21} count={70} sparkles={6} sparkleFrom={2} />
      <div className="ws-stage-scene" aria-hidden="true"><HeroScene variant="landscape" /></div>
      <div className="ws-stage-card ws-rise">
        <div className="ws-stage-logo"><BrandMark className="" /></div>
        <h1 className="ws-stage-title">Writer&apos;s Studio</h1>
        <p className="ws-stage-sub">A little practice. A bigger imagination.</p>
        <p className="ws-stage-instruction"><Lock size={14} aria-hidden="true" /> Enter the access PIN</p>
        <PinPad onSubmit={submit} shake={shake > 0 && shake % 2 === 1} />
        <p className="ws-stage-error" role={error ? 'alert' : undefined}>{error}</p>
      </div>
    </div>
  );
}
