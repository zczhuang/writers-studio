import type { LucideIcon } from 'lucide-react';
import { Zap, Eye, AudioLines, Blocks, Sparkles } from 'lucide-react';
import type { JudgeBreakdown } from '../types';

/**
 * One color + glyph + kid-friendly label per grading dimension.
 *
 * This is the visual "glue" of the app: Skill Cards, the prompt scene chip,
 * the Writing-Shape radar, the dimension sparklines, and the Result breakdown
 * bars all import this map so a writer learns to associate one color with one
 * skill everywhere. Colors are existing CSS accent variables (see index.css),
 * returned as `var(--…)` strings so they drop straight into SVG fill/stroke
 * and inline styles without fighting Tailwind's JIT purge.
 */
export interface DimensionTheme {
  key: keyof JudgeBreakdown;
  /** Formal label, e.g. "Vocabulary". */
  label: string;
  /** Warmer label for young writers, e.g. "Word Power". */
  kidLabel: string;
  /** CSS variable usable as color / fill / stroke. */
  color: string;
  Glyph: LucideIcon;
}

export const DIMENSIONS: Record<keyof JudgeBreakdown, DimensionTheme> = {
  vocabulary: { key: 'vocabulary', label: 'Vocabulary', kidLabel: 'Word Power', color: 'var(--gold)', Glyph: Zap },
  imagery: { key: 'imagery', label: 'Imagery', kidLabel: 'Picture Power', color: 'var(--teal)', Glyph: Eye },
  voice: { key: 'voice', label: 'Voice', kidLabel: 'Voice', color: 'var(--rust)', Glyph: AudioLines },
  structure: { key: 'structure', label: 'Structure', kidLabel: 'Flow & Shape', color: 'var(--moss)', Glyph: Blocks },
  originality: { key: 'originality', label: 'Originality', kidLabel: 'Fresh Ideas', color: 'var(--gold-bright)', Glyph: Sparkles },
};

/** Stable order for charts and bar lists. */
export const DIMENSION_ORDER: (keyof JudgeBreakdown)[] = [
  'vocabulary',
  'imagery',
  'voice',
  'structure',
  'originality',
];
