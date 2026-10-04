import type { CSSProperties } from 'react';
import type { JudgeBreakdown, Mode, Tier } from '../types';

/**
 * One palette for every colored surface. Each tone exposes:
 * - `hex`  for SVG fills/strokes and solid accents,
 * - `rgb`  as a space-separated triplet so CSS can tint with `rgb(var(--tone-rgb) / 0.12)`
 *          (works on iPad Safari 15.4, which lacks `color-mix()`),
 * - `ink`  a darker variant that keeps small text at WCAG AA contrast on paper.
 */
export interface Tone {
  hex: string;
  rgb: string;
  ink: string;
}

export type ToneName =
  | Mode
  | keyof JudgeBreakdown
  | 'gold'
  | 'night'
  | 'success'
  | 'danger'
  | 'neutral';

export const TONES: Record<ToneName, Tone> = {
  scene: { hex: '#12A39A', rgb: '18 163 154', ink: '#0B6B65' },
  story: { hex: '#F0694C', rgb: '240 105 76', ink: '#B5432B' },
  mystery: { hex: '#7C62F5', rgb: '124 98 245', ink: '#5640CF' },
  upgrade: { hex: '#EFA331', rgb: '239 163 49', ink: '#8F5C0A' },
  vocabulary: { hex: '#D8901A', rgb: '216 144 26', ink: '#8A5A0B' },
  imagery: { hex: '#0F9A91', rgb: '15 154 145', ink: '#0B6B65' },
  voice: { hex: '#E25A3C', rgb: '226 90 60', ink: '#B13F25' },
  structure: { hex: '#3478DB', rgb: '52 120 219', ink: '#2259AB' },
  originality: { hex: '#8B5CF6', rgb: '139 92 246', ink: '#6234CF' },
  gold: { hex: '#DE9F2C', rgb: '222 159 44', ink: '#8C5D0E' },
  night: { hex: '#223066', rgb: '34 48 102', ink: '#161C3A' },
  success: { hex: '#23946A', rgb: '35 148 106', ink: '#17704F' },
  danger: { hex: '#D9493A', rgb: '217 73 58', ink: '#AE3226' },
  neutral: { hex: '#7D839E', rgb: '125 131 158', ink: '#4A5170' },
};

/** CSS custom properties consumed by `.ws-*` classes that accept a tone. */
export function toneVars(name: ToneName, extra?: CSSProperties): CSSProperties {
  const tone = TONES[name];
  return {
    '--tone': tone.hex,
    '--tone-rgb': tone.rgb,
    '--tone-ink': tone.ink,
    ...extra,
  } as CSSProperties;
}

export interface TierPalette {
  label: string;
  light: string;
  base: string;
  deep: string;
  /** Readable text color for the tier name on paper. */
  ink: string;
  rgb: string;
}

export const TIER_PALETTE: Record<Tier, TierPalette> = {
  none: { label: 'Practice', light: '#F1F2F7', base: '#C5C9D8', deep: '#7D839E', ink: '#4A5170', rgb: '125 131 158' },
  bronze: { label: 'Bronze', light: '#F8D2AE', base: '#CD8851', deep: '#8A4E22', ink: '#8A4E22', rgb: '205 136 81' },
  silver: { label: 'Silver', light: '#FAFCFE', base: '#BCC7D3', deep: '#66788C', ink: '#4F6175', rgb: '132 150 170' },
  gold: { label: 'Gold', light: '#FFF2BF', base: '#F2BE40', deep: '#A06A0C', ink: '#8C5D0E', rgb: '242 190 64' },
  platinum: { label: 'Platinum', light: '#F4F2FF', base: '#B7BCFF', deep: '#5961D6', ink: '#4A50BE', rgb: '126 140 248' },
};

export function tierVars(tier: Tier): CSSProperties {
  const palette = TIER_PALETTE[tier];
  return {
    '--tone': palette.base,
    '--tone-rgb': palette.rgb,
    '--tone-ink': palette.ink,
    '--tier-light': palette.light,
    '--tier-deep': palette.deep,
  } as CSSProperties;
}
