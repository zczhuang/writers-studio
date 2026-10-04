import { useEffect, useState, type CSSProperties } from 'react';
import type { Tier } from '../types';

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

const TIER_GLYPH: Record<Exclude<Tier, 'none'>, string> = {
  bronze: 'B',
  silver: 'S',
  gold: 'G',
  platinum: 'P',
};

const TIER_NAME: Record<Tier, string> = {
  none: 'Practice',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

const TIER_HEX: Record<Tier, string> = {
  none: '#607476',
  bronze: '#A86224',
  silver: '#787E80',
  gold: '#B8872E',
  platinum: '#5965A1',
};

export function TierReveal({ tier, amount = 0, forfeited, onDone, revision = false, xpGained }: Props) {
  const dollars = forfeited ? 0 : Math.max(0, Number.isFinite(amount) ? amount : 0);
  const [phase, setPhase] = useState<'fade' | 'sigil' | 'amount' | 'done'>('fade');
  const [shownAmount, setShownAmount] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedTimer = window.setTimeout(() => {
        setPhase('done');
        onDone();
      }, 20);
      return () => window.clearTimeout(reducedTimer);
    }

    const t1 = window.setTimeout(() => setPhase('sigil'), 300);
    const t2 = window.setTimeout(() => setPhase('amount'), 1200);
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
      }, 900);
      return () => window.clearTimeout(doneTimer);
    }
    const start = performance.now();
    const dur = 700;
    let rafId = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownAmount(dollars * eased);
      if (t < 1) rafId = requestAnimationFrame(tick);
      else {
        doneTimer = window.setTimeout(() => {
          setPhase('done');
          onDone();
        }, tier === 'platinum' ? 1400 : 700);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(doneTimer);
    };
  }, [phase, dollars, revision, tier, onDone]);

  const isNone = tier === 'none';
  const accent = TIER_HEX[tier];

  return (
    <div className="tier-reveal fixed inset-0 z-[600] bg-bg/95 backdrop-blur-md flex items-center justify-center px-6 animate-fade-in" role="dialog" aria-modal="true" aria-live="polite" aria-label={`${TIER_NAME[tier]} result`}>
      <div className="text-center max-w-md">
        {!isNone && (
          <div className="relative inline-block mb-6">
            <svg viewBox="0 0 120 120" className="w-32 h-32" aria-hidden="true">
              <defs>
                <radialGradient id="tier-reveal-glow" cx="50%" cy="40%">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="60" cy="60" r="55" fill="url(#tier-reveal-glow)" />
              <circle cx="60" cy="60" r="46" fill="none" stroke={accent} strokeWidth="2.5" strokeDasharray={2 * Math.PI * 46} strokeDashoffset={phase === 'fade' ? 2 * Math.PI * 46 : 0} style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
              <path d="M 26 60 Q 15 50 18 40 M 26 60 Q 15 70 18 80 M 94 60 Q 105 50 102 40 M 94 60 Q 105 70 102 80" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.55" />
              <text x="60" y="73" textAnchor="middle" fontFamily={'"Crimson Pro", serif'} fontWeight="700" fontSize="42" fill={accent} style={{ opacity: phase === 'fade' ? 0 : 1, transition: 'opacity 500ms ease 600ms' }}>
                {TIER_GLYPH[tier as Exclude<Tier, 'none'>]}
              </text>
            </svg>
            {(tier === 'gold' || tier === 'platinum') && phase !== 'fade' && (
              <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none" aria-hidden="true">
                <div className="absolute -top-1 -bottom-1 -left-1 w-1/2 animate-tier-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(216,170,82,0.55), transparent)' }} />
              </div>
            )}
          </div>
        )}

        <div className="font-display text-display font-semibold tracking-tight" style={{ color: accent, opacity: phase === 'fade' ? 0 : 1, transition: 'opacity 400ms ease 600ms' }}>
          {TIER_NAME[tier]}
        </div>

        {revision ? (
          <div className="mt-3 text-center text-caption text-text-muted" style={{ opacity: phase === 'amount' || phase === 'done' ? 1 : 0, transition: 'opacity 300ms ease' }}>
            <strong className="block text-text">Revision saved</strong>
            <span>{xpGained ? `+${xpGained} XP for the effort` : 'Your feedback is ready'}</span>
          </div>
        ) : !isNone && dollars > 0 ? (
          <div className="mt-3 font-mono text-h1 font-semibold text-text tabular-nums" style={{ opacity: phase === 'amount' || phase === 'done' ? 1 : 0, transition: 'opacity 300ms ease' }}>
            +${shownAmount.toFixed(2)}
          </div>
        ) : null}

        {forfeited ? <div className="mt-3 text-caption text-text-muted max-w-xs mx-auto">You hit today&apos;s cap — this one&apos;s for practice.</div> : dollars === 0 ? <div className="mt-3 text-caption text-text-muted max-w-xs mx-auto">Practice only — no payment was recorded.</div> : null}
        {tier === 'platinum' && phase === 'amount' && <PlatinumParticles />}
      </div>
    </div>
  );
}

const PARTICLES = [
  { dx: -154, duration: 1500, delay: 0 },
  { dx: -126, duration: 1750, delay: 90 },
  { dx: -98, duration: 1320, delay: 160 },
  { dx: -70, duration: 1880, delay: 35 },
  { dx: -42, duration: 1440, delay: 220 },
  { dx: -15, duration: 1680, delay: 120 },
  { dx: 17, duration: 1260, delay: 250 },
  { dx: 44, duration: 1580, delay: 80 },
  { dx: 72, duration: 1840, delay: 190 },
  { dx: 101, duration: 1380, delay: 25 },
  { dx: 129, duration: 1720, delay: 145 },
  { dx: 157, duration: 1470, delay: 275 },
];

function PlatinumParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-gold-bright"
          style={{ animation: `particle ${particle.duration}ms ease-out ${particle.delay}ms forwards`, ['--dx' as string]: `${particle.dx}px` } as CSSProperties}
        />
      ))}
      <style>{`@keyframes particle { 0% { transform: translate(-50%, -50%) scale(.8); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% - 220px)) scale(.5); opacity: 0; } }`}</style>
    </div>
  );
}
