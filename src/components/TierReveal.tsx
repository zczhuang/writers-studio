import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Tier } from '../types';
import { TIER_PALETTE, tierVars } from '../data/tones';
import { TierMedal } from './art/TierMedal';
import { StarField } from './art/StarField';
import { Confetti } from './art/Confetti';

interface Props {
  tier: Tier;
  /** The ledger amount actually earned, after cap handling. */
  amount?: number;
  forfeited: boolean;
  onDone: () => void;
  /** Revisions celebrate effort and feedback; retained money is not a new award. */
  revision?: boolean;
  xpGained?: number;
}

export function TierReveal({ tier, amount = 0, forfeited, onDone, revision = false, xpGained }: Props) {
  const dollars = forfeited ? 0 : Math.max(0, Number.isFinite(amount) ? amount : 0);
  const [phase, setPhase] = useState<'fade' | 'sigil' | 'amount' | 'done'>('fade');
  const [shownAmount, setShownAmount] = useState(0);
  const palette = TIER_PALETTE[tier];
  const celebrate = tier === 'gold' || tier === 'platinum';

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedTimer = window.setTimeout(() => {
        setPhase('done');
        onDone();
      }, 20);
      return () => window.clearTimeout(reducedTimer);
    }

    const t1 = window.setTimeout(() => setPhase('sigil'), 250);
    const t2 = window.setTimeout(() => setPhase('amount'), 1150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  useEffect(() => {
    if (phase !== 'amount') return;
    let doneTimer = 0;
    if (revision || dollars === 0) {
      doneTimer = window.setTimeout(() => {
        setPhase('done');
        onDone();
      }, 1200);
      return () => window.clearTimeout(doneTimer);
    }
    const start = performance.now();
    const duration = 750;
    let rafId = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownAmount(dollars * eased);
      if (t < 1) rafId = requestAnimationFrame(tick);
      else {
        doneTimer = window.setTimeout(() => {
          setPhase('done');
          onDone();
        }, tier === 'platinum' ? 1500 : 900);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(doneTimer);
    };
  }, [phase, dollars, revision, tier, onDone]);

  const visible = phase !== 'fade';
  const showAmount = phase === 'amount' || phase === 'done';

  return (
    <div
      className="tier-reveal ws-reveal"
      style={tierVars(tier)}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={`${palette.label} result`}
      onClick={onDone}
    >
      <StarField seed={31} count={60} sparkles={6} sparkleFrom={2} />
      <div className="ws-reveal-rays" aria-hidden="true" />
      {celebrate && visible && <Confetti />}
      <div className="ws-reveal-inner">
        <div className={`ws-reveal-medal ${visible ? 'is-in' : ''}`} style={{ opacity: visible ? 1 : 0 }}>
          <TierMedal tier={tier} />
        </div>

        <div className="ws-reveal-title" style={{ opacity: visible ? 1 : 0, transition: 'opacity 400ms ease 450ms' }}>
          {palette.label}
        </div>

        {revision ? (
          <div className="ws-reveal-sub" style={{ opacity: showAmount ? 1 : 0, transition: 'opacity 300ms ease' }}>
            <strong>Revision saved</strong>
            <span>{xpGained ? `+${xpGained} XP for the effort` : 'Your feedback is ready'}</span>
          </div>
        ) : tier !== 'none' && dollars > 0 ? (
          <div className="ws-reveal-amount" style={{ opacity: showAmount ? 1 : 0, transition: 'opacity 300ms ease' }}>
            +${shownAmount.toFixed(2)}
          </div>
        ) : null}

        {forfeited ? (
          <div className="ws-reveal-sub">You hit today&apos;s cap, so this one&apos;s for practice.</div>
        ) : dollars === 0 && !revision ? (
          <div className="ws-reveal-sub">Practice only. No payment was recorded.</div>
        ) : null}

        {!revision && xpGained ? (
          <div className="ws-reveal-sub" style={{ opacity: showAmount ? 1 : 0, transition: 'opacity 300ms ease 150ms' }}>
            <span className="inline-flex items-center gap-1.5 font-bold text-white"><Sparkles size={15} aria-hidden="true" /> +{xpGained} XP</span>
          </div>
        ) : null}

        <p className="ws-reveal-skip ws-small">Tap anywhere to continue</p>
      </div>
    </div>
  );
}
