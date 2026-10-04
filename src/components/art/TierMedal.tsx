import { useId } from 'react';
import type { Tier } from '../../types';
import { TIER_PALETTE } from '../../data/tones';
import { scallopPath, starPoints, svgId } from './random';

const ROSETTE = scallopPath(80, 76, 60, 54, 24);
const STAR = starPoints(80, 76, 19, 8);
const SPARKLE = starPoints(80, 76, 21, 6, 4);

const LAUREL_LEFT = [
  { x: 49, y: 92, r: -50 },
  { x: 45, y: 82, r: -70 },
  { x: 44, y: 71, r: -90 },
  { x: 46, y: 60, r: -110 },
];

/** An award rosette in the tier's metal. `tier="none"` draws a quiet practice feather. */
export function TierMedal({ tier, className = '', title }: { tier: Tier; className?: string; title?: string }) {
  const id = svgId(useId());
  const palette = TIER_PALETTE[tier];
  const practice = tier === 'none';
  return (
    <svg className={className} viewBox="0 0 160 190" role="img" aria-label={title ?? `${palette.label} medal`} focusable="false">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.light} />
          <stop offset="0.45" stopColor={palette.base} />
          <stop offset="1" stopColor={palette.deep} />
        </linearGradient>
        <radialGradient id={`${id}-disc`} cx="0.34" cy="0.28" r="0.85">
          <stop offset="0" stopColor={palette.light} />
          <stop offset="0.55" stopColor={palette.base} />
          <stop offset="1" stopColor={palette.deep} />
        </radialGradient>
        <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.deep} />
          <stop offset="1" stopColor={palette.base} />
        </linearGradient>
        <linearGradient id={`${id}-iris`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB5E8" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#B5F0FF" stopOpacity="0.15" />
          <stop offset="1" stopColor="#C8B5FF" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <path d="M58 112 L38 180 L53 171 L64 186 L80 122 Z" fill={`url(#${id}-ribbon)`} />
      <path d="M102 112 L122 180 L107 171 L96 186 L80 122 Z" fill={`url(#${id}-ribbon)`} />
      <path d="M61 118 L46 172 L52 168 L66 122 Z M99 118 L114 172 L108 168 L94 122 Z" fill="#FFFFFF" opacity="0.18" />

      <path d={ROSETTE} fill={`url(#${id}-rim)`} />
      <circle cx="80" cy="76" r="46" fill={`url(#${id}-disc)`} />
      {tier === 'platinum' && <circle cx="80" cy="76" r="46" fill={`url(#${id}-iris)`} />}
      <circle cx="80" cy="76" r="38.5" fill="none" stroke={palette.light} strokeOpacity="0.75" strokeWidth="2" />
      <circle cx="80" cy="76" r="36" fill="none" stroke={palette.deep} strokeOpacity="0.35" strokeWidth="1" />

      <g fill={palette.light} stroke={palette.deep} strokeOpacity="0.35" strokeWidth="0.8">
        {LAUREL_LEFT.map((leaf, index) => (
          <ellipse key={`l-${index}`} cx={leaf.x} cy={leaf.y} rx="2.6" ry="6" transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`} />
        ))}
        {LAUREL_LEFT.map((leaf, index) => (
          <ellipse key={`r-${index}`} cx={160 - leaf.x} cy={leaf.y} rx="2.6" ry="6" transform={`rotate(${-leaf.r} ${160 - leaf.x} ${leaf.y})`} />
        ))}
      </g>

      {practice ? (
        <g transform="translate(80 76) rotate(-35)">
          <path d="M0 -24 C12 -16 12 6 2 22 L0 26 L-2 22 C-12 6 -12 -16 0 -24 Z" fill={palette.light} stroke={palette.deep} strokeOpacity="0.5" strokeWidth="1.2" />
          <path d="M0 -20 V24" stroke={palette.deep} strokeOpacity="0.6" strokeWidth="1.2" />
        </g>
      ) : tier === 'platinum' ? (
        <polygon points={SPARKLE} fill={palette.light} stroke={palette.deep} strokeOpacity="0.45" strokeWidth="1.2" />
      ) : (
        <polygon points={STAR} fill={palette.light} stroke={palette.deep} strokeOpacity="0.45" strokeWidth="1.2" strokeLinejoin="round" />
      )}

      <path d="M47 58 A38 38 0 0 1 92 39" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
