import type { Entry, JudgeBreakdown, Mode, WriterMemory } from '../types';
import { SKILL_CARDS, type SkillCard } from '../data/skillCards';
import { tokens } from '../utils/text';

const DIMS: (keyof JudgeBreakdown)[] = ['vocabulary', 'imagery', 'voice', 'structure', 'originality'];
const MODES: Mode[] = ['scene', 'story', 'mystery', 'upgrade'];

/** Human labels kept local so this service stays free of React/lucide imports. */
const DIM_LABEL: Record<keyof JudgeBreakdown, string> = {
  vocabulary: 'vocabulary',
  imagery: 'imagery',
  voice: 'voice',
  structure: 'structure (flow & shape)',
  originality: 'originality',
};

/** Recency weight for the mastery EWMA. Higher = more responsive to the latest piece. */
const ALPHA = 0.35;
const VAULT_CAP = 40;

/** Common 7+ letter words that aren't "vivid" — kept out of the vocabulary vault. */
const COMMON_LONG = new Set([
  'because', 'through', 'thought', 'something', 'someone', 'anything', 'everyone', 'everything',
  'another', 'between', 'against', 'without', 'around', 'really', 'though', 'before', 'should',
  'would', 'could', 'little', 'people', 'started', 'looked', 'wanted', 'suddenly', 'finally',
  'nothing', 'himself', 'herself', 'myself', 'getting', 'happened', 'probably', 'actually',
]);

export function emptyMemory(): WriterMemory {
  return {
    mastery: { vocabulary: 0, imagery: 0, voice: 0, structure: 0, originality: 0 },
    sampleCount: 0,
    piecesByMode: { scene: 0, story: 0, mystery: 0, upgrade: 0 },
    strength: null,
    growthEdge: null,
    growthTargetByMode: {},
    lastGrowth: null,
    vocabularyVault: [],
    recentlyShownSkills: [],
    lastSkillSource: null,
    bestScore: 0,
    updatedAt: 0,
  };
}

function strengthAndEdge(mastery: JudgeBreakdown): {
  strength: keyof JudgeBreakdown;
  growthEdge: keyof JudgeBreakdown;
} {
  let strength = DIMS[0];
  let edge = DIMS[0];
  for (const d of DIMS) {
    if (mastery[d] > mastery[strength]) strength = d;
    if (mastery[d] < mastery[edge]) edge = d;
  }
  return { strength, growthEdge: edge };
}

/** Dimensions ordered weakest → strongest (for recommendation fallback). */
function dimsByWeakness(mastery: JudgeBreakdown): (keyof JudgeBreakdown)[] {
  return [...DIMS].sort((a, b) => mastery[a] - mastery[b]);
}

function mergeVault(existing: string[], text: string): string[] {
  const have = new Set(existing.map((w) => w.toLowerCase()));
  const fresh: string[] = [];
  for (const t of tokens(text)) {
    const w = t.toLowerCase();
    if (w.length >= 7 && /^[a-z]+$/.test(w) && !COMMON_LONG.has(w) && !have.has(w)) {
      have.add(w);
      fresh.push(w);
    }
  }
  // newest first, capped
  return [...fresh.reverse(), ...existing].slice(0, VAULT_CAP);
}

/**
 * Fold one graded piece into memory. Pure. Also computes the "did you grow?"
 * signal by comparing this piece against the dimension the coach last targeted
 * for this mode, BEFORE updating the EWMA.
 */
export function foldEntry(memory: WriterMemory, entry: Entry): WriterMemory {
  const b = entry.judge.breakdown;
  const first = memory.sampleCount === 0;
  const alpha = first ? 1 : ALPHA;

  // "Did you grow?" — measured against the prior target, prior to updating.
  const priorTarget = memory.growthTargetByMode[entry.mode] ?? memory.growthEdge;
  let lastGrowth: WriterMemory['lastGrowth'] = null;
  if (!first && priorTarget) {
    const improved = b[priorTarget] >= Math.round(memory.mastery[priorTarget]) + 1;
    lastGrowth = { dimension: priorTarget, improved, mode: entry.mode };
  }

  const mastery = {} as JudgeBreakdown;
  for (const d of DIMS) mastery[d] = +(memory.mastery[d] * (1 - alpha) + b[d] * alpha).toFixed(3);

  const { strength, growthEdge } = strengthAndEdge(mastery);

  return {
    ...memory,
    mastery,
    sampleCount: memory.sampleCount + 1,
    piecesByMode: { ...memory.piecesByMode, [entry.mode]: (memory.piecesByMode[entry.mode] ?? 0) + 1 },
    strength,
    growthEdge,
    growthTargetByMode: { ...memory.growthTargetByMode, [entry.mode]: growthEdge },
    lastGrowth,
    vocabularyVault: mergeVault(memory.vocabularyVault, entry.text),
    bestScore: Math.max(memory.bestScore, entry.judge.score),
    updatedAt: entry.createdAt,
  };
}

/** Rebuild memory from scratch over a list of entries (used by the v2→v3 migration). */
export function buildMemory(entries: Entry[]): WriterMemory {
  let m = emptyMemory();
  for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt)) m = foldEntry(m, e);
  return m;
}

/**
 * A compact WRITER CONTEXT block injected into the coaching prompt. It exists to
 * personalize tone and targeting — never to move the score. Returns '' before
 * the writer has any history so cold-start grading is unaffected.
 */
export function coachContext(memory: WriterMemory, mode: Mode): string {
  if (memory.sampleCount === 0) return '';
  const lines: string[] = [
    'WRITER CONTEXT (use ONLY to personalize encouragement and pick which suggestion to emphasize — it must NOT change the score; grade strictly on the merits of THIS piece):',
    `- Pieces coached so far: ${memory.sampleCount}.`,
  ];
  if (memory.strength) lines.push(`- Tends to be strongest at: ${DIM_LABEL[memory.strength]}.`);
  if (memory.growthEdge) lines.push(`- Current growth edge to nudge: ${DIM_LABEL[memory.growthEdge]}.`);
  const target = memory.growthTargetByMode[mode];
  if (target) {
    lines.push(
      `- Last time on a ${mode} piece, we worked on ${DIM_LABEL[target]}. If this piece improves there, name the improvement warmly and specifically; if not, re-coach it gently.`
    );
  }
  if (memory.vocabularyVault.length >= 3) {
    lines.push(`- Vivid words they've used before (don't force these): ${memory.vocabularyVault.slice(0, 6).join(', ')}.`);
  }
  lines.push('Keep praise honest and specific. Tie at most ONE suggestion to the growth edge.');
  return lines.join('\n');
}

/** Skill-card recommendation targeting the writer's weakest dimension. */
export function recommendSkill(memory: WriterMemory, masteredIds: string[] = []): SkillCard | null {
  const mastered = new Set(masteredIds);
  const recent = new Set(memory.recentlyShownSkills);

  const pick = (cards: SkillCard[]): SkillCard | null => {
    const open = cards.filter((c) => !mastered.has(c.id));
    if (open.length === 0) return null;
    const ranked = [...open].sort((a, b) => {
      const ar = recent.has(a.id) ? 1 : 0;
      const br = recent.has(b.id) ? 1 : 0;
      if (ar !== br) return ar - br; // not-recently-shown first
      const as = a.source === memory.lastSkillSource ? 1 : 0;
      const bs = b.source === memory.lastSkillSource ? 1 : 0;
      return as - bs; // alternate classic/contemporary
    });
    return ranked[0];
  };

  // Warm-up: before there's a real weakness signal, offer a gentle imagery card.
  if (memory.sampleCount < 1 || !memory.growthEdge) {
    return pick(SKILL_CARDS.filter((c) => c.dimension === 'imagery')) ?? pick(SKILL_CARDS);
  }

  for (const dim of dimsByWeakness(memory.mastery)) {
    const found = pick(SKILL_CARDS.filter((c) => c.dimension === dim));
    if (found) return found;
  }
  return pick(SKILL_CARDS);
}

// ── Chart helpers (read straight from entries; keep memory small) ──────────────

/** Average of each dimension over the last `n` entries — the radar baseline. */
export function averageBreakdown(entries: Entry[], n = 20): JudgeBreakdown {
  const slice = entries.slice(-n);
  const out: JudgeBreakdown = { vocabulary: 0, imagery: 0, voice: 0, structure: 0, originality: 0 };
  if (slice.length === 0) return out;
  for (const e of slice) for (const d of DIMS) out[d] += e.judge.breakdown[d];
  for (const d of DIMS) out[d] = +(out[d] / slice.length).toFixed(2);
  return out;
}

/** Per-dimension series over the last `n` entries — for sparklines. */
export function dimensionSeries(entries: Entry[], n = 8): Record<keyof JudgeBreakdown, number[]> {
  const slice = entries.slice(-n);
  const out = { vocabulary: [], imagery: [], voice: [], structure: [], originality: [] } as Record<
    keyof JudgeBreakdown,
    number[]
  >;
  for (const e of slice) for (const d of DIMS) out[d].push(e.judge.breakdown[d]);
  return out;
}

/** Simple trend label from a numeric series. */
export function trendOf(series: number[]): 'climbing' | 'steady' | 'dipping' {
  if (series.length < 3) return 'steady';
  const half = Math.floor(series.length / 2);
  const early = series.slice(0, half);
  const late = series.slice(half);
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const delta = avg(late) - avg(early);
  if (delta >= 0.6) return 'climbing';
  if (delta <= -0.6) return 'dipping';
  return 'steady';
}

export { MODES };
