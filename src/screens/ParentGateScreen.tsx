import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { PinPad } from '../components/ui/PinPad';
import { verifyPin } from '../services/pinHash';
import { Button } from '../components/ui/Button';
import { toneVars } from '../data/tones';
import {
  browserDeadlineRuntime,
  parentAccessIsActive,
  remainingCooldownSeconds,
  startDeadlineWatcher,
} from '../services/accessTiming';

const PARENT_UNLOCK_MS = 10 * 60 * 1000;

export function ParentGateScreen() {
  const { state, dispatch } = useApp();
  const [shake, setShake] = useState(0);
  const [error, setError] = useState('');
  const attempts = useRef(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockedUntil <= 0) return;
    return startDeadlineWatcher({
      deadlineMs: lockedUntil,
      tickEveryMs: 1000,
      runtime: browserDeadlineRuntime(),
      onTime: (nowMs) => {
        setClockNow(nowMs);
        if (!parentAccessIsActive(lockedUntil, nowMs)) {
          setLockedUntil(0);
          setError('');
        }
      },
    });
  }, [lockedUntil]);

  const lockedRemainingSec = remainingCooldownSeconds(lockedUntil, clockNow);

  const submit = async (pin: string) => {
    const attemptNow = Date.now();
    if (parentAccessIsActive(lockedUntil, attemptNow)) {
      setClockNow(attemptNow);
      setShake((value) => value + 1);
      return;
    }
    if (lockedUntil !== 0) {
      setLockedUntil(0);
      setError('');
    }

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
        const failureNow = Date.now();
        setClockNow(failureNow);
        setLockedUntil(failureNow + 30_000);
        setError('Too many wrong PINs. Wait 30s.');
        attempts.current = 0;
      } else {
        setError(`Wrong PIN. ${3 - attempts.current} ${3 - attempts.current === 1 ? 'try' : 'tries'} left.`);
      }
    }
  };

  return (
    <div className="flex min-h-[72vh] items-center justify-center">
      <div className="ws-card ws-card-pad ws-rise w-full max-w-[26rem] text-center">
        <span className="ws-medallion ws-medallion--lg ws-medallion--solid mx-auto" style={toneVars('night')} aria-hidden="true">
          <ShieldCheck size={26} />
        </span>
        <h1 className="ws-h2 mt-4">Parent PIN</h1>
        <p className="ws-small mx-auto mt-2 mb-6 max-w-xs">Four digits unlock payouts, settings, and cloud backup for 10 minutes.</p>

        {lockedRemainingSec > 0 && (
          <div className="ws-callout ws-callout--warn mb-4 justify-center" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>Locked for {lockedRemainingSec}s</span>
          </div>
        )}

        <PinPad onSubmit={submit} shake={shake > 0 && shake % 2 === 1} />

        <p className="ws-stage-error" role={error && lockedRemainingSec === 0 ? 'alert' : undefined}>
          {lockedRemainingSec === 0 ? error : ''}
        </p>

        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'NAV_BACK' })} className="mt-2">
          Cancel
        </Button>
      </div>
    </div>
  );
}
