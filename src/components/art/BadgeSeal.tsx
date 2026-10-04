import { useId } from 'react';
import { scallopPath, svgId } from './random';

const EDGE = scallopPath(50, 50, 49, 44, 18);

/** A gold wax-seal medallion; locked seals are pressed paper. */
export function BadgeSeal({ earned }: { earned: boolean }) {
  const id = svgId(useId());
  if (!earned) {
    return (
      <svg className="ws-seal-bg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path d={EDGE} fill="#ECE2CF" />
        <circle cx="50" cy="50" r="36" fill="#F6EFE2" />
        <circle cx="50" cy="50" r="31" fill="none" stroke="#D6C5A7" strokeWidth="1.5" strokeDasharray="3 4" />
      </svg>
    );
  }
  return (
    <svg className="ws-seal-bg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE7A0" />
          <stop offset="0.5" stopColor="#E8A93A" />
          <stop offset="1" stopColor="#A86E10" />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFF6D6" />
          <stop offset="0.6" stopColor="#F5CB62" />
          <stop offset="1" stopColor="#D99A28" />
        </radialGradient>
      </defs>
      <path d={EDGE} fill={`url(#${id}-edge)`} />
      <circle cx="50" cy="50" r="36" fill={`url(#${id}-face)`} />
      <circle cx="50" cy="50" r="31" fill="none" stroke="#A86E10" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M27 38 A26 26 0 0 1 58 24" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
