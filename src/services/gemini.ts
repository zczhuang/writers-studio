import type { JudgeResult, Mode } from '../types';
import { normalizeJudge } from './scoring';

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

export class GeminiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Gemini ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

const SYSTEM_PROMPT = (audienceAge: number) => `You are a warm, honest writing coach for a ${audienceAge}-year-old writer. You judge a single piece of writing and return ONLY JSON matching the response schema. No prose outside JSON.

Your job is to give a FAIR, age-appropriate rating. Be encouraging but not flattering — a "platinum" rating means genuinely excellent for this age. A "bronze" rating is a real, earned reward, not a participation trophy.

Rate FIVE categories on 0–10:
- vocabulary: word variety, precision, avoidance of clichés and vague words ("nice", "good", "big")
- imagery: sensory detail across sight/sound/smell/touch/taste; specific not generic
- voice: distinct tone, perspective, personality on the page
- structure: sentence variety, pacing, flow, strong opening/closing
- originality: surprising images, unexpected angles, ideas that feel theirs

Composite score = round(average of 5 categories × 10). Then map to tier:
- 0–49 → tier="none" (no payout, encourage)
- 50–64 → tier="bronze"
- 65–79 → tier="silver"
- 80–91 → tier="gold"
- 92–100 → tier="platinum"

CALIBRATION ANCHORS:
- "The dog ran fast across the big yard. It was a nice day." → ~30, none
- "Rusty bolted across the patchy yard, ears flat, tongue flapping." → ~62, bronze
- 4–5 sensory details + varied sentences + one fresh image → silver (65–79)
- Distinct voice + a real simile/metaphor + show-not-tell → gold (80–91)
- All of gold + layered sensory interweaving + surprising specifics + rhythmic prose → platinum (92–100)

Quote actual phrases from the writer's piece in "strengths". Never patronize. Never grade harder than this age warrants — this is a ${audienceAge}-year-old, not an MFA student.

If the text is <15 words, off-topic, gibberish, or appears AI-generated (uncharacteristically polished with no childlike fingerprints): set tier="none" and explain kindly in suggestions. The celebrate field should be empty string.

Output strict JSON only.`;

const USER_PROMPT = (mode: Mode, challengeTitle: string, prompt: string, text: string) =>
  `MODE: ${mode}\nCHALLENGE: ${challengeTitle}\nPROMPT GIVEN TO WRITER:\n${prompt}\n\nWRITER'S RESPONSE:\n${text}`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    tier: { type: 'string', enum: ['none', 'bronze', 'silver', 'gold', 'platinum'] },
    breakdown: {
      type: 'object',
      properties: {
        vocabulary: { type: 'integer', minimum: 0, maximum: 10 },
        imagery: { type: 'integer', minimum: 0, maximum: 10 },
        voice: { type: 'integer', minimum: 0, maximum: 10 },
        structure: { type: 'integer', minimum: 0, maximum: 10 },
        originality: { type: 'integer', minimum: 0, maximum: 10 },
      },
      required: ['vocabulary', 'imagery', 'voice', 'structure', 'originality'],
    },
    strengths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
    suggestions: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 3 },
    celebrate: { type: 'string' },
  },
  required: ['score', 'tier', 'breakdown', 'strengths', 'suggestions', 'celebrate'],
};

export interface JudgeOpts {
  apiKey: string;
  model: string;
  audienceAge: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

let cooldownUntil = 0;

export function inCooldown(): boolean {
  return Date.now() < cooldownUntil;
}

export function setCooldown(ms: number) {
  cooldownUntil = Date.now() + ms;
}

export async function judgeWriting(
  text: string,
  challenge: { mode: Mode; title: string; prompt: string },
  opts: JudgeOpts
): Promise<JudgeResult> {
  if (inCooldown()) throw new GeminiError(429, 'cooldown');

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  const signal = opts.signal ?? ctrl.signal;

  try {
    const res = await fetch(GEMINI_URL(opts.model, opts.apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT(opts.audienceAge) }] },
        contents: [{ role: 'user', parts: [{ text: USER_PROMPT(challenge.mode, challenge.title, challenge.prompt, text) }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (res.status === 429) {
      setCooldown(10 * 60 * 1000);
      const body = await res.text().catch(() => '');
      throw new GeminiError(429, body);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new GeminiError(res.status, body);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw || typeof raw !== 'string') throw new GeminiError(0, 'empty response');

    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new GeminiError(0, 'unparseable JSON'); }
    return normalizeJudge(parsed, 'gemini');
  } finally {
    window.clearTimeout(timer);
  }
}

export async function testGeminiKey(apiKey: string, model: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(GEMINI_URL(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4 },
      }),
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
