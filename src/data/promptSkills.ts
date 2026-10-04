import type { Challenge, JudgeBreakdown } from '../types';

type Dim = keyof JudgeBreakdown;

/** Keyword → dimension rules, applied to a prompt's `skill` label. */
const RULES: { re: RegExp; dim: Dim }[] = [
  { re: /verb|word|adjective|precision|vocab/i, dim: 'vocabulary' },
  { re: /sensory|visual|sound|colou?r|light|atmosphere|weather|winter|warmth|setting|scale|detail|observation|descriptive|description|imagery|mood|wonder|show/i, dim: 'imagery' },
  { re: /voice|tone|humor|humour|character|celebration|emotion/i, dim: 'voice' },
  { re: /suspense|tension|mystery|movement|action|transformation|pacing|build/i, dim: 'structure' },
  { re: /creative|discovery|wonder|original|surprise/i, dim: 'originality' },
];

/** Best-effort mapping of a prompt's skill label to the grading dimension(s) it exercises. */
export function dimensionsForSkill(skill: string): Dim[] {
  const dims = new Set<Dim>();
  for (const { re, dim } of RULES) if (re.test(skill)) dims.add(dim);
  if (dims.size === 0) dims.add('imagery');
  return [...dims];
}

/** Prefer explicit `dimensions` on the challenge, else derive from its skill label. */
export function dimensionsForChallenge(c: Challenge): Dim[] {
  return c.dimensions && c.dimensions.length > 0 ? c.dimensions : dimensionsForSkill(c.skill);
}
