import { useId } from 'react';
import { sparklePath, svgId } from './random';

/** A small treasure chest spilling coins, for the wallet header. */
export function TreasureArt({ className = '' }: { className?: string }) {
  const id = svgId(useId());
  return (
    <svg className={className} viewBox="0 0 160 140" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F7D88D" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F7D88D" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B4652E" />
          <stop offset="1" stopColor="#7A3E17" />
        </linearGradient>
        <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CC7A3C" />
          <stop offset="1" stopColor="#934A1D" />
        </linearGradient>
        <radialGradient id={`${id}-coin`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFF4C4" />
          <stop offset="0.6" stopColor="#F2BE40" />
          <stop offset="1" stopColor="#B07A10" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="70" r="66" fill={`url(#${id}-glow)`} />
      <ellipse cx="80" cy="128" rx="58" ry="7" fill="#05081A" opacity="0.4" />
      <g>
        <circle cx="62" cy="58" r="11" fill={`url(#${id}-coin)`} />
        <circle cx="84" cy="50" r="12" fill={`url(#${id}-coin)`} />
        <circle cx="104" cy="60" r="10" fill={`url(#${id}-coin)`} />
        <circle cx="74" cy="64" r="10" fill={`url(#${id}-coin)`} />
        <circle cx="94" cy="66" r="11" fill={`url(#${id}-coin)`} />
      </g>
      <path d="M24 70 H136 V118 a8 8 0 0 1 -8 8 H32 a8 8 0 0 1 -8 -8 Z" fill={`url(#${id}-wood)`} />
      <path d="M20 66 H140 V76 H20 Z" fill="#F2BE40" />
      <path d="M24 92 H136 M24 108 H136" stroke="#5E2E10" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="40" y="70" width="10" height="56" fill="#F2BE40" opacity="0.95" />
      <rect x="110" y="70" width="10" height="56" fill="#F2BE40" opacity="0.95" />
      <rect x="70" y="80" width="20" height="22" rx="4" fill="#F7D88D" stroke="#B07A10" strokeWidth="1.5" />
      <circle cx="80" cy="89" r="3" fill="#7A3E17" />
      <path d="M78.5 90 h3 l1 6 h-5 Z" fill="#7A3E17" />
      <path d="M26 66 C26 40 50 30 80 30 C110 30 134 40 134 66 Z" fill={`url(#${id}-lid)`} transform="rotate(-14 26 66) translate(-6 -8)" />
      <g fill="#FFFFFF">
        <path className="ws-star-twinkle" d={sparklePath(118, 36, 6)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '1.1s' }} d={sparklePath(40, 42, 4)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '2s' }} d={sparklePath(140, 82, 3.5)} />
      </g>
    </svg>
  );
}
