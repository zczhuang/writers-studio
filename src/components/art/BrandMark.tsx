import { useId } from 'react';
import { svgId } from './random';

/** The app mark: an open book under a crescent moon. Matches public/favicon.svg. */
export function BrandMark({ className = 'ws-brand-mark' }: { className?: string }) {
  const id = svgId(useId());
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2C3B7A" />
          <stop offset="1" stopColor="#0B1026" />
        </linearGradient>
        <linearGradient id={`${id}-page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFDF6" />
          <stop offset="1" stopColor="#F3E3C2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-sky)`} />
      <circle cx="46" cy="17" r="7" fill="#F6D58A" />
      <circle cx="49.5" cy="14.5" r="6" fill="#1D2959" />
      <circle cx="17" cy="14" r="1.3" fill="#F6D58A" />
      <circle cx="27" cy="9" r="1" fill="#FFFFFF" opacity="0.8" />
      <path d="M8 31c8-4 17-3.5 24 1.5V52c-7-4.6-16-5-24-1.6Z" fill={`url(#${id}-page)`} />
      <path d="M56 31c-8-4-17-3.5-24 1.5V52c7-4.6 16-5 24-1.6Z" fill={`url(#${id}-page)`} />
      <path d="M32 32.5V52" stroke="#DE9F2C" strokeWidth="2" />
      <path d="M13 37.5c5-1.6 10-1.2 14 .8M13 42.5c5-1.6 10-1.2 14 .8M51 37.5c-5-1.6-10-1.2-14 .8M51 42.5c-5-1.6-10-1.2-14 .8" stroke="#C9A86A" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
