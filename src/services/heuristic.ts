import type { Challenge, JudgeBreakdown, JudgeResult } from '../types';
import { CLICHES, SENSORY, SENSORY_BY_SENSE, STRONG_VERBS, VAGUE, senseOf } from '../data/wordLists';
import { clamp, countWords, sentenceLengths, splitSentences, stdev, tokens, typeTokenRatio } from '../utils/text';
import { normalizeJudge } from './scoring';

// Match "X like Y" where X is descriptive context, not a verb use of "like".
// Implemented WITHOUT lookbehind because iOS Safari <16.4 (and iPad Chrome on
// those versions, since iOS Chrome uses WebKit) throws a SyntaxError at parse
// time on lookbehind regex literals — that would crash the entire bundle.
const SIMILE_LIKE_CANDIDATE = /([a-z']+)?\s+like\s+(?:a|an|the\s+)?[a-z]+/gi;
const SIMILE_LIKE_SKIP_PREV = new Set([
  'i','you','they','she','he','we','would','do','does','did',
  "don't",'dont',"didn't",'didnt','will','might','may','could',
  'never','ever','just','should','must',
]);
function hasSimileLike(text: string): boolean {
  for (const m of text.matchAll(SIMILE_LIKE_CANDIDATE)) {
    const prev = (m[1] ?? '').toLowerCase();
    if (!SIMILE_LIKE_SKIP_PREV.has(prev)) return true;
  }
  return false;
}
const SIMILE_AS = /\bas\s+[a-z]+\s+as\s+(?:a|an|the\s+)?[a-z]+/i;
const METAPHOR = /\b(?:was|were|is|are)\s+(?:a|an)\s+[a-z]+/i;
const DIALOGUE = /["“"][^"“”]{2,200}["”"]/g;

function dialogueScore(text: string): number {
  const matches = text.match(DIALOGUE);
  if (!matches) return 0;
  return clamp(matches.length, 0, 3);
}

function punctuationVariety(text: string): number {
  let v = 0;
  if (text.includes('!')) v++;
  if (text.includes('?')) v++;
  if (text.includes(';') || text.includes(':')) v++;
  if (text.includes(' — ') || text.includes(' – ') || text.includes('—')) v++;
  return clamp(v, 0, 3);
}

function startsWithVague(text: string): boolean {
  const first = (text.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z']/g, '');
  return VAGUE.has(first);
}

function endsWithVague(text: string): boolean {
  const sents = splitSentences(text);
  const last = sents[sents.length - 1] ?? '';
  const w = (last.split(/\s+/).pop() ?? '').toLowerCase().replace(/[^a-z']/g, '');
  return VAGUE.has(w);
}

function clicheCount(text: string): number {
  const lower = text.toLowerCase();
  return CLICHES.reduce((n, c) => n + (lower.includes(c) ? 1 : 0), 0);
}

interface Counts {
  sensory: number;
  strong: number;
  vague: number;
  sensesCovered: number;
  wordCount: number;
}

function countSignals(text: string): Counts {
  const toks = tokens(text);
  const senses = new Set<keyof typeof SENSORY_BY_SENSE>();
  let sensory = 0, strong = 0, vague = 0;
  for (const w of toks) {
    if (SENSORY.has(w)) {
      sensory++;
      const s = senseOf(w);
      if (s) senses.add(s);
    }
    if (STRONG_VERBS.has(w)) strong++;
    if (VAGUE.has(w)) vague++;
  }
  return { sensory, strong, vague, sensesCovered: senses.size, wordCount: toks.length };
}

function dimensions(text: string, counts: Counts): JudgeBreakdown {
  // Vocabulary
  const ttr = typeTokenRatio(text);
  const vocab = clamp(Math.round(ttr * 18) - Math.min(4, counts.vague), 0, 10);

  // Imagery
  const imagery = clamp(counts.sensory + counts.sensesCovered, 0, 10);

  // Voice
  const voice = clamp(2 + dialogueScore(text) + punctuationVariety(text), 0, 10);

  // Structure
  const lens = sentenceLengths(text);
  const sentCount = lens.length;
  const sdev = stdev(lens);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  let structure = 0;
  if (sentCount >= 3) structure += 3;
  if (sdev >= 4) structure += 3;
  if (avg >= 7 && avg <= 22) structure += 2;
  if (!startsWithVague(text)) structure += 1;
  if (!endsWithVague(text)) structure += 1;
  structure = clamp(structure, 0, 10);

  // Originality
  let origin = 0;
  if (hasSimileLike(text) || SIMILE_AS.test(text)) origin += 3;
  if (METAPHOR.test(text)) origin += 3;
  if (counts.strong >= 2) origin += 2;
  if (clicheCount(text) === 0) origin += 2;
  origin = clamp(origin, 0, 10);

  return { vocabulary: vocab, imagery, voice, structure, originality: origin };
}

function pickStrengths(b: JudgeBreakdown, c: Counts): string[] {
  const out: string[] = [];
  if (b.imagery >= 7) out.push(`Strong sensory work — I count ${c.sensory} vivid details across ${c.sensesCovered} senses.`);
  if (b.originality >= 7) out.push('Original images and word choices — not the cliché ones.');
  if (b.voice >= 7) out.push('Real voice on the page — I can hear someone telling this.');
  if (b.structure >= 7) out.push('Nice variety in sentence lengths — the rhythm carries the reader.');
  if (b.vocabulary >= 8) out.push('Precise, varied vocabulary — barely any repeated words.');
  if (out.length === 0 && c.wordCount >= 30) out.push('Solid effort — every piece is practice.');
  return out.slice(0, 3);
}

function pickSuggestions(b: JudgeBreakdown, c: Counts, target: [number, number]): string[] {
  const out: string[] = [];
  if (c.wordCount < target[0]) out.push(`Try for ${target[0]}–${target[1]} words — you're at ${c.wordCount}.`);
  if (b.imagery < 5) out.push('Add 1–2 sensory details — what could you hear or smell?');
  if (c.vague > 0) out.push(`Swap out ${c.vague} vague word${c.vague > 1 ? 's' : ''} (like "nice" or "big") for something specific.`);
  if (b.originality < 5) out.push('Try one specific simile or metaphor — what is this scene LIKE?');
  if (b.structure < 5) out.push('Mix sentence lengths — try one short, one long.');
  if (b.voice < 5) out.push('Add a small detail of voice — a quick joke, an opinion, a question.');
  return out.slice(0, 3);
}

function pickCelebrate(text: string): string {
  const sents = splitSentences(text);
  let best = '';
  let bestScore = -1;
  for (const s of sents) {
    const wc = countWords(s);
    if (wc < 5 || wc > 30) continue;
    const toks = tokens(s);
    const has = toks.some((w) => SENSORY.has(w) || STRONG_VERBS.has(w));
    if (!has) continue;
    if (wc > bestScore) { best = s; bestScore = wc; }
  }
  return best;
}

export function heuristicJudge(text: string, challenge: Challenge): JudgeResult {
  const wordCount = countWords(text);
  const minTarget = challenge.targetWords[0];

  // Hard gate for very short submissions
  if (wordCount < 15) {
    return normalizeJudge({
      score: 0,
      breakdown: { vocabulary: 0, imagery: 0, voice: 0, structure: 0, originality: 0 },
      strengths: [],
      suggestions: [`Try writing at least ${minTarget} words — you've got more to say.`],
      celebrate: '',
    }, 'heuristic');
  }

  const counts = countSignals(text);
  const b = dimensions(text, counts);

  // Composite = sum × 2 → /100
  let composite = (b.vocabulary + b.imagery + b.voice + b.structure + b.originality) * 2;
  // Cap at 49 if heavily under target
  if (wordCount < minTarget * 0.6) composite = Math.min(composite, 49);

  return normalizeJudge({
    score: composite,
    breakdown: b,
    strengths: pickStrengths(b, counts),
    suggestions: pickSuggestions(b, counts, challenge.targetWords),
    celebrate: pickCelebrate(text),
  }, 'heuristic');
}
