import { Coins } from 'lucide-react';
import { useDailyCap } from '../hooks/useDailyCap';
import { useApp } from '../state/AppContext';

export function EarningsPill() {
  const { state, dispatch } = useApp();
  const cap = useDailyCap();

  if (!state.settings.parentPinHash) return null;

  return (
    <button
      type="button"
      onClick={() => dispatch({ type: 'NAV', screen: 'wallet' })}
      className={`ws-pill ${cap.capHit ? 'is-capped' : ''}`}
      aria-label={`Today's earnings ${cap.earnedToday.toFixed(2)} dollars out of ${cap.cap.toFixed(2)}`}
    >
      <Coins size={15} className="ws-pill-coin" aria-hidden="true" />
      <span>${cap.earnedToday.toFixed(2)}</span>
      <span className="ws-pill-cap">/ ${cap.cap.toFixed(2)}</span>
    </button>
  );
}
