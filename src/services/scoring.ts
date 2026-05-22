import type { Tier, JudgeResult, JudgeBreakdown } from '../types';

export function mapScoreToTier(score: number): Tier {
  if (score < 50) return 'none';
  if (score < 65) return 'bronze';
  if (score < 80) return 'silver';
  if (score < 92) return 'gold';
  return 'platinum';
}

export function tierToDollars(tier: Tier): number {
  switch (tier) {
    case 'bronze':   return 0.10;
    case 'silver':   return 0.25;
    case 'gold':     return 0.50;
    case 'platinum': return 1.00;
    case 'none':
    default:         return 0;
  }
}

export function tierLabel(tier: Tier): string {
  return tier === 'none' ? 'Practice' : tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function tierColor(tier: Tier): string {
  switch (tier) {
    case 'bronze':   return 'var(--tier-bronze)';
    case 'silver':   return 'var(--tier-silver)';
    case 'gold':     return 'var(--tier-gold)';
    case 'platinum': return 'var(--tier-platinum)';
    case 'none':
    default:         return 'var(--text-muted)';
  }
}

/** Defensive clamp + normalize for any judge result coming in from outside (Gemini). */
export function normalizeJudge(raw: unknown, source: 'gemini' | 'heuristic'): JudgeResult {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const b = (obj.breakdown && typeof obj.breakdown === 'object' ? obj.breakdown : {}) as Record<string, unknown>;
  const clamp = (n: unknown, lo: number, hi: number): number => {
    const x = typeof n === 'number' && isFinite(n) ? n : 0;
    return Math.max(lo, Math.min(hi, Math.round(x)));
  };

  const breakdown: JudgeBreakdown = {
    vocabulary:  clamp(b.vocabulary,  0, 10),
    imagery:     clamp(b.imagery,     0, 10),
    voice:       clamp(b.voice,       0, 10),
    structure:   clamp(b.structure,   0, 10),
    originality: clamp(b.originality, 0, 10),
  };

  let score = clamp(obj.score, 0, 100);
  // Defensive: if score is 0 but breakdown isn't, recompute from breakdown
  const sum = breakdown.vocabulary + breakdown.imagery + breakdown.voice + breakdown.structure + breakdown.originality;
  if (score === 0 && sum > 0) score = Math.min(100, Math.round(sum * 2));

  const tier = mapScoreToTier(score);

  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 4) : [];
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');

  return {
    score,
    tier,
    breakdown,
    strengths: arr(obj.strengths),
    suggestions: arr(obj.suggestions),
    celebrate: str(obj.celebrate),
    source,
  };
}
