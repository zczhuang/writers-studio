import { useId } from 'react';
import { sparklePath, svgId } from './random';

interface Props {
  className?: string;
  /** Lock/onboarding stage backgrounds drop the book for a wider landscape. */
  variant?: 'hero' | 'landscape';
}

/**
 * The night-sky storybook: an open book on a moonlit hill, paper planes and
 * sparkles rising from its pages toward the moon. Pure inline SVG.
 */
export function HeroScene({ className = 'ws-scene', variant = 'hero' }: Props) {
  const id = svgId(useId());
  const showBook = variant === 'hero';

  return (
    <svg
      className={className}
      viewBox="0 0 560 380"
      role="img"
      aria-label="An open storybook on a moonlit hill, with paper planes rising toward the moon"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-moon-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FCE7AE" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FCE7AE" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFDF7" />
          <stop offset="1" stopColor="#F2E2C2" />
        </linearGradient>
        <linearGradient id={`${id}-page-r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFBF1" />
          <stop offset="1" stopColor="#ECDBB7" />
        </linearGradient>
        <linearGradient id={`${id}-cover`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E0664F" />
          <stop offset="1" stopColor="#9E3524" />
        </linearGradient>
        <linearGradient id={`${id}-swirl`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F7D88D" stopOpacity="0.95" />
          <stop offset="1" stopColor="#F7D88D" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-hill-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34478E" />
          <stop offset="1" stopColor="#24326A" />
        </linearGradient>
        <linearGradient id={`${id}-hill-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#25336C" />
          <stop offset="1" stopColor="#1A2552" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <mask id={`${id}-crescent`}>
          <rect x="380" y="20" width="120" height="120" fill="#FFFFFF" />
          <circle cx="454" cy="66" r="27" fill="#000000" />
        </mask>
      </defs>

      {/* Moon */}
      <circle cx="440" cy="78" r="86" fill={`url(#${id}-moon-glow)`} />
      <circle cx="440" cy="78" r="31" fill="#FCE7AE" mask={`url(#${id}-crescent)`} />

      {/* Sky glints */}
      <g fill="#F7D88D">
        <path className="ws-star-twinkle" d={sparklePath(118, 70, 7)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '1.2s' }} d={sparklePath(352, 42, 5)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '2.1s' }} d={sparklePath(214, 34, 4)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '0.6s' }} d={sparklePath(512, 156, 4.5)} />
      </g>
      <g fill="#FFFFFF" opacity="0.8">
        <circle cx="62" cy="40" r="1.4" />
        <circle cx="168" cy="96" r="1.1" />
        <circle cx="292" cy="70" r="1.3" />
        <circle cx="398" cy="148" r="1" />
        <circle cx="506" cy="40" r="1.2" />
        <circle cx="34" cy="132" r="1" />
      </g>

      {/* Far hills with a castle and a lighthouse: the worlds on the horizon */}
      <path d="M0 262 C70 226 122 232 172 248 C222 264 262 232 322 224 C382 216 432 246 482 240 C522 236 546 226 560 222 L560 380 L0 380 Z" fill={`url(#${id}-hill-far)`} />
      <g fill="#1B2758">
        <rect x="92" y="214" width="34" height="30" />
        <rect x="86" y="204" width="11" height="40" />
        <rect x="121" y="200" width="11" height="44" />
        <path d="M85 204 L91.5 190 L98 204 Z" />
        <path d="M120 200 L126.5 184 L133 200 Z" />
        <rect x="102" y="196" width="14" height="22" />
        <path d="M101 196 L109 178 L117 196 Z" />
        <path d="M109 178 V168 L118 171 L109 174" stroke="#1B2758" strokeWidth="1.5" fill="#F0694C" />
      </g>
      <g fill="#FFD27A">
        <rect x="106" y="203" width="5" height="7" rx="2.5" />
        <rect x="124" y="210" width="4" height="6" rx="2" />
        <rect x="89" y="212" width="4" height="6" rx="2" />
      </g>
      <g>
        <path d="M494 236 L506 236 L503.5 196 L496.5 196 Z" fill="#E9E2FF" />
        <path d="M495.3 214 L504.7 214 L505.1 222 L494.9 222 Z M496.1 202 L503.9 202 L504.2 208 L495.8 208 Z" fill="#F0694C" />
        <rect x="495" y="190" width="10" height="6" rx="1.5" fill="#FFE7A6" />
        <path d="M494 190 L500 183 L506 190 Z" fill="#F0694C" />
        <path d="M505 193 L560 178 L560 206 Z" fill="#FFE7A6" opacity="0.22" />
        <circle cx="500" cy="193" r="9" fill="#FFE7A6" opacity="0.25" filter={`url(#${id}-glow)`} />
      </g>

      {/* Mid hills */}
      <path d="M0 298 C60 276 130 280 190 294 C250 308 300 286 360 282 C430 278 490 296 560 286 L560 380 L0 380 Z" fill={`url(#${id}-hill-mid)`} />
      <g fill="#141D46">
        <circle cx="40" cy="282" r="13" />
        <rect x="38.5" y="290" width="3" height="12" />
        <circle cx="64" cy="288" r="9" />
        <rect x="62.8" y="294" width="2.4" height="9" />
        <circle cx="520" cy="280" r="12" />
        <rect x="518.6" y="288" width="2.8" height="12" />
      </g>

      {/* Glowing trail toward the book */}
      <path d="M30 372 C90 352 120 334 176 330 C226 326 238 316 262 306" fill="none" stroke="#F7D88D" strokeWidth="6" strokeLinecap="round" opacity="0.35" filter={`url(#${id}-glow)`} />
      <path d="M30 372 C90 352 120 334 176 330 C226 326 238 316 262 306" fill="none" stroke="#FCE7AE" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 9" />

      {/* Near ground */}
      <path d="M0 336 C80 320 160 324 240 336 C320 348 400 334 480 328 C520 325 545 328 560 330 L560 380 L0 380 Z" fill="#131B42" />

      {showBook && (
        <g>
          <ellipse cx="280" cy="304" rx="160" ry="15" fill="#05081A" opacity="0.55" filter={`url(#${id}-blur)`} />
          {/* Cover */}
          <path d="M116 216 C174 192 236 194 280 220 C324 194 386 192 444 216 L444 300 C386 278 324 280 280 306 C236 280 174 278 116 300 Z" fill={`url(#${id}-cover)`} />
          {/* Page block */}
          <path d="M126 208 C180 186 238 188 280 212 L280 296 C238 272 180 270 126 292 Z" fill="#E4D2AF" />
          <path d="M434 208 C380 186 322 188 280 212 L280 296 C322 272 380 270 434 292 Z" fill="#DCC8A2" />
          <path d="M128 203 C182 181 240 183 280 207 L280 291 C240 267 182 265 128 287 Z" fill={`url(#${id}-page)`} />
          <path d="M432 203 C378 181 320 183 280 207 L280 291 C320 267 378 265 432 287 Z" fill={`url(#${id}-page-r)`} />
          <path d="M280 207 V291" stroke="#B8935A" strokeWidth="1.6" opacity="0.6" />
          <path d="M262 199 C270 202 276 204 280 207 L280 291 C276 288 270 285 262 282 Z" fill="#8C6A35" opacity="0.08" />
          <path d="M298 199 C290 202 284 204 280 207 L280 291 C284 288 290 285 298 282 Z" fill="#8C6A35" opacity="0.1" />
          {/* Lines of writing */}
          <g fill="none" stroke="#C9AE7D" strokeWidth="2.2" strokeLinecap="round" opacity="0.85">
            <path d="M148 219 C190 205 232 207 264 222" />
            <path d="M148 233 C190 219 232 221 264 236" />
            <path d="M148 247 C190 233 232 235 264 250" />
            <path d="M148 261 C182 249 214 250 238 260" />
            <path d="M412 219 C370 205 328 207 296 222" />
            <path d="M412 233 C370 219 328 221 296 236" />
            <path d="M412 247 C370 233 328 235 296 250" />
          </g>
          <path d="M318 284 L332 280 L334 322 L326 313 L318 324 Z" fill="#7C62F5" />
          <path d="M318 284 L332 280 L332.4 288 L318.3 292 Z" fill="#5A43D3" />
          {/* Magic rising from the pages */}
          <path d="M282 206 C252 172 328 154 300 120 C280 96 334 78 326 52" fill="none" stroke={`url(#${id}-swirl)`} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" />
          <g fill="#F7D88D">
            <path className="ws-star-twinkle" d={sparklePath(262, 168, 6)} />
            <path className="ws-star-twinkle" style={{ animationDelay: '0.9s' }} d={sparklePath(316, 138, 4.5)} />
            <path className="ws-star-twinkle" style={{ animationDelay: '1.7s' }} d={sparklePath(292, 98, 5)} />
            <path className="ws-star-twinkle" style={{ animationDelay: '2.4s' }} d={sparklePath(336, 70, 3.5)} />
          </g>
          <g fontFamily="'Fraunces Variable', Georgia, serif" fontStyle="italic" fill="#FFF3D6">
            <text x="226" y="186" fontSize="20" opacity="0.75" className="ws-float">a</text>
            <text x="340" y="176" fontSize="16" opacity="0.6" className="ws-float" style={{ animationDelay: '1.5s' }}>&amp;</text>
            <text x="246" y="128" fontSize="14" opacity="0.5" className="ws-float" style={{ animationDelay: '3s' }}>Q</text>
          </g>
          {/* Paper planes */}
          <g stroke="#E3BF73" strokeWidth="1.2" strokeLinejoin="round">
            <g transform="translate(346 148) rotate(-20) scale(1.15)">
              <path d="M0 10 L30 0 L14 22 L12 13 Z" fill="#FFF8E7" />
              <path d="M12 13 L30 0" fill="none" />
            </g>
            <g transform="translate(386 102) rotate(-26) scale(0.85)">
              <path d="M0 10 L30 0 L14 22 L12 13 Z" fill="#FFF8E7" />
              <path d="M12 13 L30 0" fill="none" />
            </g>
            <g transform="translate(214 142) scale(-0.72 0.72) rotate(-22)">
              <path d="M0 10 L30 0 L14 22 L12 13 Z" fill="#FFF8E7" />
              <path d="M12 13 L30 0" fill="none" />
            </g>
          </g>
        </g>
      )}
    </svg>
  );
}
