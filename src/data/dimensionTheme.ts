import type { LucideIcon } from 'lucide-react';
import { Zap, Eye, AudioLines, Blocks, Sparkles } from 'lucide-react';
import type { JudgeBreakdown } from '../types';
import { TONES } from './tones';

/**
 * One color + glyph + kid-friendly label per grading dimension.
 *
 * This is the visual "glue" of the app: Skill Cards, the prompt scene chip,
 * the Writing-Shape radar, the dimension sparklines, and the Result breakdown
 * bars all import this map so a writer learns to associate one color with one
 * skill everywhere. Each dimension has its own distinct hue (see `TONES`).
 */
export interface DimensionTheme {
  key: keyof JudgeBreakdown;
  /** Formal label, e.g. "Vocabulary". */
  label: string;
  /** Warmer label for young writers, e.g. "Word Power". */
  kidLabel: string;
  /** Solid color usable as color / fill / stroke. */
  color: string;
  /** Space-separated RGB triplet for translucent tints: `rgb(${rgb} / 0.12)`. */
  rgb: string;
  /** Darker variant for small text on paper. */
  ink: string;
  Glyph: LucideIcon;
}

export const DIMENSIONS: Record<keyof JudgeBreakdown, DimensionTheme> = {
  vocabulary: { key: 'vocabulary', label: 'Vocabulary', kidLabel: 'Word Power', color: TONES.vocabulary.hex, rgb: TONES.vocabulary.rgb, ink: TONES.vocabulary.ink, Glyph: Zap },
  imagery: { key: 'imagery', label: 'Imagery', kidLabel: 'Picture Power', color: TONES.imagery.hex, rgb: TONES.imagery.rgb, ink: TONES.imagery.ink, Glyph: Eye },
  voice: { key: 'voice', label: 'Voice', kidLabel: 'Voice', color: TONES.voice.hex, rgb: TONES.voice.rgb, ink: TONES.voice.ink, Glyph: AudioLines },
  structure: { key: 'structure', label: 'Structure', kidLabel: 'Flow & Shape', color: TONES.structure.hex, rgb: TONES.structure.rgb, ink: TONES.structure.ink, Glyph: Blocks },
  originality: { key: 'originality', label: 'Originality', kidLabel: 'Fresh Ideas', color: TONES.originality.hex, rgb: TONES.originality.rgb, ink: TONES.originality.ink, Glyph: Sparkles },
};

/** Stable order for charts and bar lists. */
export const DIMENSION_ORDER: (keyof JudgeBreakdown)[] = [
  'vocabulary',
  'imagery',
  'voice',
  'structure',
  'originality',
];
