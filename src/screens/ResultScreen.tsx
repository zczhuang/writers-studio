import { useEffect, useState } from 'react';
import { Coins, Sparkles, Quote, Cpu, PenLine, ArrowRight, Home } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { TierReveal } from '../components/TierReveal';
import { Button } from '../components/ui/Button';
import { tierLabel, tierToDollars } from '../services/scoring';

const TIER_TEXT_CLASS: Record<string, string> = {
  none: 'text-text-faint',
  bronze: 'text-tier-bronze',
  silver: 'text-tier-silver',
  gold: 'text-tier-gold',
  platinum: 'text-tier-platinum',
};

export function ResultScreen() {
  const { state, dispatch } = useApp();
  const entry = state.entries[state.entries.length - 1];
  const judge = state.lastJudge ?? entry?.judge;
  const [revealDone, setRevealDone] = useState(false);

  useEffect(() => {
    if (!entry) dispatch({ type: 'NAV_RESET', screen: 'home' });
  }, [entry, dispatch]);

  if (!entry || !judge) return null;

  const ledger = state.earnings.ledger.find((l) => l.id === entry.earningsId);
  const forfeited = ledger?.status === 'forfeited' && judge.tier !== 'none';
  const dollars = ledger?.amount ?? tierToDollars(judge.tier);

  const dimensions: { key: keyof typeof judge.breakdown; label: string }[] = [
    { key: 'vocabulary',  label: 'Vocabulary'   },
    { key: 'imagery',     label: 'Imagery'      },
    { key: 'voice',       label: 'Voice'        },
    { key: 'structure',   label: 'Structure'    },
    { key: 'originality', label: 'Originality'  },
  ];

  return (
    <>
      {!revealDone && (
        <TierReveal tier={judge.tier} forfeited={forfeited} onDone={() => setRevealDone(true)} />
      )}

      {revealDone && (
        <div className="space-y-5 animate-slide-up">
          {/* Headline result */}
          <div className="text-center pt-2">
            <p className="text-micro uppercase tracking-wider text-text-faint font-semibold mb-1">Result</p>
            <h1 className={`font-display text-display font-semibold leading-none ${TIER_TEXT_CLASS[judge.tier]}`}>
              {tierLabel(judge.tier)}
            </h1>
            {judge.tier !== 'none' && (
              <div className="mt-3 inline-flex items-center gap-2 text-h1 font-mono font-semibold text-text tabular-nums">
                <Coins size={20} className="text-gold" />
                <span>+${dollars.toFixed(2)}</span>
              </div>
            )}
            {forfeited && (
              <p className="text-caption text-text-muted mt-2">Daily cap reached — counts for practice, no payment.</p>
            )}
            <div className="mt-3 inline-flex items-center gap-1.5 text-micro uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface border border-white/8 text-text-muted">
              <Cpu size={11} />
              <span>{judge.source === 'gemini' ? 'AI coach' : 'Local scoring'}</span>
              <span className="text-text-faint">·</span>
              <span className="tabular-nums">{judge.score}/100</span>
            </div>
          </div>

          {/* Breakdown */}
          <section className="bg-surface border border-white/5 rounded-xl p-5">
            <h2 className="font-display text-h3 font-semibold text-text mb-3">Score breakdown</h2>
            <div className="space-y-2.5">
              {dimensions.map((d) => (
                <div key={d.key} className="flex items-center gap-3">
                  <span className="text-caption text-text-muted w-24 shrink-0">{d.label}</span>
                  <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold-deep to-gold-bright rounded-full"
                      style={{ width: `${judge.breakdown[d.key] * 10}%` }}
                    />
                  </div>
                  <span className="font-mono text-caption font-semibold text-text tabular-nums w-8 text-right">
                    {judge.breakdown[d.key]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Celebrate */}
          {judge.celebrate && judge.tier !== 'none' && (
            <section className="bg-gold/10 border border-gold/25 rounded-xl p-4">
              <div className="flex items-start gap-2.5">
                <Quote size={18} className="text-gold shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-micro text-gold uppercase tracking-wider font-semibold mb-1">Line worth celebrating</div>
                  <p className="font-serif italic text-text leading-snug">"{judge.celebrate}."</p>
                </div>
              </div>
            </section>
          )}

          {/* Strengths */}
          {judge.strengths.length > 0 && (
            <section className="bg-surface border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-moss" />
                <h2 className="font-display text-h3 font-semibold text-text">What worked</h2>
              </div>
              <ul className="space-y-1.5 text-caption text-text-muted font-serif">
                {judge.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-moss shrink-0">·</span><span>{s}</span></li>
                ))}
              </ul>
            </section>
          )}

          {/* Suggestions */}
          {judge.suggestions.length > 0 && (
            <section className="bg-surface border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <PenLine size={16} className="text-gold" />
                <h2 className="font-display text-h3 font-semibold text-text">Try next</h2>
              </div>
              <ul className="space-y-1.5 text-caption text-text-muted font-serif">
                {judge.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-gold shrink-0">·</span><span>{s}</span></li>
                ))}
              </ul>
            </section>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: 'CLEAR_LAST_JUDGE' });
                dispatch({ type: 'NAV_RESET', screen: 'home' });
              }}
              className="flex-1"
            >
              <Home size={16} /> Home
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                dispatch({ type: 'CLEAR_LAST_JUDGE' });
                dispatch({ type: 'NAV_RESET', screen: 'mode-list' });
              }}
              className="flex-[2]"
            >
              Write another <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
