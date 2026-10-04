import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Coins, Lock, Receipt } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useDailyCap } from '../hooks/useDailyCap';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { TierChip } from '../components/TierChip';
import { StarField } from '../components/art/StarField';
import { TreasureArt } from '../components/art/TreasureArt';
import { MODE_THEME } from '../data/modeTheme';
import { toneVars } from '../data/tones';
import { prettyDate } from '../utils/date';
import { tierLabel } from '../services/scoring';

function parentAccessIsActive(until: number): boolean {
  return until > Date.now();
}

export function WalletScreen() {
  const { state, dispatch } = useApp();
  const cap = useDailyCap();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [authNow, setAuthNow] = useState(() => Date.now());
  const isParent = state.parentUnlockedUntil > authNow;

  useEffect(() => {
    const remaining = state.parentUnlockedUntil - Date.now();
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => {
      setAuthNow(Date.now());
      setSelecting(false);
      setSelected(new Set());
    }, remaining + 25);
    return () => window.clearTimeout(timeout);
  }, [state.parentUnlockedUntil]);

  const ledger = [...state.earnings.ledger].sort((a, b) => b.createdAt - a.createdAt);
  const pending = ledger.filter((l) => l.status === 'pending');
  const selectableTotal = pending.filter((l) => selected.has(l.id)).reduce((s, l) => s + l.amount, 0);

  const startPayout = () => {
    if (!parentAccessIsActive(state.parentUnlockedUntil)) {
      dispatch({ type: 'REQUEST_PARENT_GATE', target: 'wallet' });
      return;
    }
    setSelecting(true);
    setSelected(new Set(pending.map((p) => p.id)));
  };

  const confirmPayout = () => {
    if (!parentAccessIsActive(state.parentUnlockedUntil)) {
      setSelecting(false);
      setSelected(new Set());
      dispatch({ type: 'REQUEST_PARENT_GATE', target: 'wallet' });
      return;
    }
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
    <div className="ws-page">
      <section className="ws-wallet-hero ws-night ws-rise" aria-labelledby="wallet-title">
        <StarField seed={9} count={36} sparkles={4} />
        <div className="min-w-0">
          <h1 id="wallet-title" className="ws-wallet-label">Waiting for payout</h1>
          <div className="ws-wallet-amount">${state.earnings.lifetimePending.toFixed(2)}</div>
          <div className="ws-wallet-split">
            <div><span>Paid so far</span><strong>${state.earnings.lifetimePaid.toFixed(2)}</strong></div>
            <div><span>Lifetime earned</span><strong>${(state.earnings.lifetimePaid + state.earnings.lifetimePending).toFixed(2)}</strong></div>
          </div>
          <div className="mt-6 max-w-md">
            <div className="mb-2 flex justify-between text-[0.85rem] font-semibold text-[var(--night-muted)]">
              <span>Today&apos;s earnings</span>
              <span className="tabular text-white">${cap.earnedToday.toFixed(2)} of ${cap.cap.toFixed(2)}</span>
            </div>
            <ProgressBar pct={cap.pct} tone={cap.capHit ? 'danger' : 'gold'} label="Today's earnings toward the daily cap" />
            <p className="ws-small mt-2 mb-0">{cap.capHit ? 'Today’s cap is reached. New pieces still count for practice.' : `$${cap.remaining.toFixed(2)} left to earn today.`}</p>
          </div>
        </div>
        <TreasureArt className="ws-wallet-art ws-float" />
      </section>

      <div className="ws-rise" style={{ '--i': 1 } as CSSProperties}>
        {!selecting ? (
          <Button
            variant={pending.length > 0 ? 'gold' : 'ghost'}
            size="lg"
            fullWidth
            disabled={pending.length === 0}
            onClick={startPayout}
          >
            {isParent ? <Coins size={19} aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}
            {pending.length === 0
              ? 'Nothing to pay out yet'
              : isParent
                ? `Pay out $${state.earnings.lifetimePending.toFixed(2)}`
                : 'Parent: pay out'}
          </Button>
        ) : (
          <div className="ws-write-actions">
            <Button variant="ghost" onClick={() => { setSelecting(false); setSelected(new Set()); }}>
              Cancel
            </Button>
            <Button variant="gold" onClick={confirmPayout} disabled={selected.size === 0}>
              <Check size={18} aria-hidden="true" /> Pay ${selectableTotal.toFixed(2)} ({selected.size})
            </Button>
          </div>
        )}
      </div>

      <section className="ws-rise" style={{ '--i': 2 } as CSSProperties} aria-labelledby="history-title">
        <div className="ws-section-head">
          <div>
            <p className="ws-kicker"><Receipt size={14} aria-hidden="true" /> Every reward, recorded</p>
            <h2 id="history-title" className="ws-h2">History</h2>
          </div>
          {selecting && <span className="ws-small">Choose the rewards you&apos;re paying now</span>}
        </div>
        {ledger.length === 0 ? (
          <div className="ws-empty">
            <Coins size={32} aria-hidden="true" />
            <h3 className="ws-h3">No earnings yet</h3>
            <p>Write your first piece. Bronze and above earn a reward, within the daily cap.</p>
          </div>
        ) : (
          <ul className="ws-ledger">
            {ledger.map((l) => {
              const entry = state.entries.find((e) => e.id === l.entryId);
              const selectable = selecting && l.status === 'pending';
              const isSelected = selected.has(l.id);
              const theme = entry ? MODE_THEME[entry.mode] : null;
              const content = (
                <>
                  {selectable ? (
                    <span className="ws-checkbox" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                  ) : (
                    <span className="ws-medallion ws-medallion--sm" style={toneVars(entry?.mode ?? 'neutral')} aria-hidden="true">
                      {theme ? <theme.Icon size={16} /> : <Coins size={16} />}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="ws-ledger-title block">{entry?.challengeTitle ?? 'Entry'}</span>
                    <span className="ws-ledger-meta">
                      <TierChip tier={l.tier} label={tierLabel(l.tier)} />
                      <span>{prettyDate(l.createdAt)}</span>
                    </span>
                  </span>
                  <span className="ws-ledger-amount">
                    <strong>+${l.amount.toFixed(2)}</strong>
                    <span className={`ws-status is-${l.status}`}>{l.status}</span>
                  </span>
                </>
              );
              return (
                <li key={l.id}>
                  {selectable ? (
                    <button
                      type="button"
                      onClick={() => toggle(l.id)}
                      aria-pressed={isSelected}
                      className={`ws-ledger-row is-selectable ${isSelected ? 'is-selected' : ''}`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="ws-ledger-row">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
