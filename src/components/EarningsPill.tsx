import { Coins } from 'lucide-react';
import { useDailyCap } from '../hooks/useDailyCap';
import { useApp } from '../state/AppContext';

export function EarningsPill() {
  const { state, dispatch } = useApp();
  const cap = useDailyCap();

  if (!state.settings.parentPinHash) return null;

  return (
    <button
      onClick={() => dispatch({ type: 'NAV', screen: 'wallet' })}
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 border transition-colors ${
        cap.capHit
          ? 'bg-rust/15 border-rust/40 text-rust'
          : 'bg-surface border-white/10 text-gold hover:border-gold/40'
      }`}
    >
      <Coins size={14} />
      <span className="font-mono font-semibold text-caption tabular-nums">
        ${cap.earnedToday.toFixed(2)}
      </span>
      <span className="text-text-faint text-caption">/ ${cap.cap.toFixed(2)}</span>
    </button>
  );
}
