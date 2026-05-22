import { useState } from 'react';
import { Coins, Lock } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useDailyCap } from '../hooks/useDailyCap';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { prettyDate } from '../utils/date';
import type { Tier } from '../types';
import { tierLabel } from '../services/scoring';

const TIER_CLASS: Record<Tier, string> = {
  none: 'text-text-faint',
  bronze: 'text-tier-bronze',
  silver: 'text-tier-silver',
  gold: 'text-tier-gold',
  platinum: 'text-tier-platinum',
};

export function WalletScreen() {
  const { state, dispatch } = useApp();
  const cap = useDailyCap();
  const isParent = state.parentUnlockedUntil > Date.now();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ledger = [...state.earnings.ledger].sort((a, b) => b.createdAt - a.createdAt);
  const pending = ledger.filter((l) => l.status === 'pending');
  const selectableTotal = pending.filter((l) => selected.has(l.id)).reduce((s, l) => s + l.amount, 0);

  const startPayout = () => {
    if (!isParent) {
      dispatch({ type: 'REQUEST_PARENT_GATE', target: 'wallet' });
      return;
    }
    setSelecting(true);
    setSelected(new Set(pending.map((p) => p.id)));
  };

  const confirmPayout = () => {
    dispatch({ type: 'PAY_LEDGER', ids: [...selected] });
    setSelecting(false);
    setSelected(new Set());
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <header>
        <h1 className="font-display text-h1 font-semibold text-text">Wallet</h1>
        <p className="text-text-muted text-caption mt-1">Your earnings, ready for payout.</p>
      </header>

      <section className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="text-micro text-text-faint uppercase tracking-wider font-semibold mb-1">Pending</div>
        <div className="font-mono text-display font-semibold text-gold tabular-nums leading-none">
          ${state.earnings.lifetimePending.toFixed(2)}
        </div>
        <div className="mt-4 flex justify-between text-caption text-text-muted">
          <div>
            <div className="text-micro text-text-faint uppercase tracking-wider">Paid</div>
            <div className="font-mono text-h3 font-semibold text-text tabular-nums">${state.earnings.lifetimePaid.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-micro text-text-faint uppercase tracking-wider">Lifetime</div>
            <div className="font-mono text-h3 font-semibold text-text tabular-nums">
              ${(state.earnings.lifetimePaid + state.earnings.lifetimePending).toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between text-caption mb-2">
          <span className="text-text-muted">Today's progress</span>
          <span className="font-mono tabular-nums text-text">${cap.earnedToday.toFixed(2)} / ${cap.cap.toFixed(2)}</span>
        </div>
        <ProgressBar pct={cap.pct} variant={cap.capHit ? 'rust' : 'gold'} />
      </section>

      {!selecting ? (
        <Button
          variant={pending.length > 0 ? 'gold' : 'ghost'}
          fullWidth
          disabled={pending.length === 0}
          onClick={startPayout}
        >
          {isParent ? <Coins size={18} /> : <Lock size={16} />}
          {pending.length === 0
            ? 'Nothing to pay out yet'
            : isParent
              ? `Pay out $${state.earnings.lifetimePending.toFixed(2)}`
              : 'Parent: pay out'}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { setSelecting(false); setSelected(new Set()); }} className="flex-1">
            Cancel
          </Button>
          <Button variant="gold" onClick={confirmPayout} disabled={selected.size === 0} className="flex-[2]">
            Pay ${selectableTotal.toFixed(2)} ({selected.size})
          </Button>
        </div>
      )}

      <section>
        <h2 className="font-display text-h2 font-semibold text-text mb-3">History</h2>
        {ledger.length === 0 ? (
          <p className="text-caption text-text-muted py-8 text-center">No earnings yet — write your first piece.</p>
        ) : (
          <div className="space-y-2">
            {ledger.map((l) => {
              const entry = state.entries.find((e) => e.id === l.entryId);
              const isSelected = selected.has(l.id);
              return (
                <div
                  key={l.id}
                  onClick={() => selecting && l.status === 'pending' && toggle(l.id)}
                  className={`bg-surface border rounded-xl p-3 flex items-center justify-between gap-3 transition-colors ${
                    selecting && l.status === 'pending' ? 'cursor-pointer' : ''
                  } ${isSelected ? 'border-gold/60 bg-gold/5' : 'border-white/5'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-caption text-text-muted truncate">{entry?.challengeTitle ?? 'Entry'}</div>
                    <div className="flex items-center gap-2 text-micro mt-0.5">
                      <span className={`uppercase tracking-wider font-semibold ${TIER_CLASS[l.tier]}`}>{tierLabel(l.tier)}</span>
                      <span className="text-text-faint">·</span>
                      <span className="text-text-faint">{prettyDate(l.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-body font-semibold text-text tabular-nums">+${l.amount.toFixed(2)}</div>
                    <div className={`text-micro font-medium uppercase tracking-wider ${
                      l.status === 'paid' ? 'text-moss' : l.status === 'forfeited' ? 'text-text-faint' : 'text-gold'
                    }`}>
                      {l.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
