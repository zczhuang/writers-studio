import { useEffect, useState } from 'react';
import type { Tier } from '../types';
import { tierToDollars } from '../services/scoring';

interface Props {
  tier: Tier;
  forfeited: boolean;
  onDone: () => void;
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
  none: '#5B6B86',
  bronze: '#B87333',
  silver: '#B8B8B8',
  gold: '#D4A24C',
  platinum: '#DCE6F5',
};

export function TierReveal({ tier, forfeited, onDone }: Props) {
  const dollars = forfeited ? 0 : tierToDollars(tier);
  const [phase, setPhase] = useState<'fade' | 'sigil' | 'amount' | 'done'>('fade');
  const [shownAmount, setShownAmount] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('sigil'), 300);
    const t2 = window.setTimeout(() => setPhase('amount'), 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'amount') return;
    if (dollars === 0) {
      const t = window.setTimeout(() => { setPhase('done'); onDone(); }, 900);
      return () => window.clearTimeout(t);
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
        window.setTimeout(() => { setPhase('done'); onDone(); }, tier === 'platinum' ? 1400 : 700);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, dollars, tier, onDone]);

  const isNone = tier === 'none';
  const accent = TIER_HEX[tier];

  return (
    <div className="fixed inset-0 z-[600] bg-bg/95 backdrop-blur-md flex items-center justify-center px-6 animate-fade-in">
      <div className="text-center max-w-md">
        {!isNone && (
          <div className="relative inline-block mb-6">
            <svg viewBox="0 0 120 120" className="w-32 h-32" aria-hidden>
              <defs>
                <radialGradient id="tg" cx="50%" cy="40%">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="60" cy="60" r="55" fill="url(#tg)" />
              <circle
                cx="60" cy="60" r="46"
                fill="none"
                stroke={accent}
                strokeWidth="2.5"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={phase === 'fade' ? 2 * Math.PI * 46 : 0}
                style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
              {/* Laurel-leaf style flourishes */}
              <path d="M 26 60 Q 15 50 18 40" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.55" />
              <path d="M 26 60 Q 15 70 18 80" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.55" />
              <path d="M 94 60 Q 105 50 102 40" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.55" />
              <path d="M 94 60 Q 105 70 102 80" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.55" />
              <text
                x="60" y="73"
                textAnchor="middle"
                fontFamily='"Crimson Pro", serif'
                fontWeight="700"
                fontSize="42"
                fill={accent}
                style={{ opacity: phase === 'fade' ? 0 : 1, transition: 'opacity 500ms ease 600ms' }}
              >
                {TIER_GLYPH[tier as Exclude<Tier, 'none'>]}
              </text>
            </svg>
            {(tier === 'gold' || tier === 'platinum') && phase !== 'fade' && (
              <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                <div
                  className="absolute -top-1 -bottom-1 -left-1 w-1/2 animate-tier-shimmer"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(232,185,90,0.55), transparent)',
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div
          className="font-display text-display font-semibold tracking-tight"
          style={{ color: accent, opacity: phase === 'fade' ? 0 : 1, transition: 'opacity 400ms ease 600ms' }}
        >
          {TIER_NAME[tier]}
        </div>

        {!isNone && (
          <div
            className="mt-3 font-mono text-h1 font-semibold text-text tabular-nums"
            style={{ opacity: phase === 'amount' || phase === 'done' ? 1 : 0, transition: 'opacity 300ms ease' }}
          >
            +${shownAmount.toFixed(2)}
          </div>
        )}

        {forfeited && (
          <div className="mt-3 text-caption text-text-muted max-w-xs mx-auto">
            You hit today's cap — this one's for the practice.
          </div>
        )}

        {tier === 'platinum' && phase === 'amount' && <PlatinumParticles />}
      </div>
    </div>
  );
}

function PlatinumParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 14 }).map((_, i) => {
        const dx = (Math.random() - 0.5) * 320;
        const dur = 1100 + Math.random() * 900;
        const delay = Math.random() * 300;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-gold-bright"
            style={{
              animation: `particle ${dur}ms ease-out ${delay}ms forwards`,
              ['--dx' as string]: `${dx}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes particle {
          0%   { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% - 220px)) scale(0.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
