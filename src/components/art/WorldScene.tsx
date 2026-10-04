import { useId } from 'react';
import type { Mode } from '../../types';
import { sparklePath, svgId } from './random';

interface Props {
  mode: Mode;
  className?: string;
}

const LABELS: Record<Mode, string> = {
  scene: 'A lighthouse on a sea cliff at dusk',
  story: 'A winding path to a castle at sunset',
  mystery: 'A moonlit manor seen through a magnifying glass',
  upgrade: 'A quill turning plain words into golden ones',
};

/** One illustrated landscape per writing world (viewBox 320×200). */
export function WorldScene({ mode, className = '' }: Props) {
  const id = svgId(useId());
  return (
    <svg className={className} viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label={LABELS[mode]} focusable="false">
      {mode === 'scene' && <Lighthouse id={id} />}
      {mode === 'story' && <Castle id={id} />}
      {mode === 'mystery' && <Manor id={id} />}
      {mode === 'upgrade' && <Workshop id={id} />}
    </svg>
  );
}

function Lighthouse({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A3A4E" />
          <stop offset="0.55" stopColor="#13807D" />
          <stop offset="1" stopColor="#A6E6D3" />
        </linearGradient>
        <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#11938B" />
          <stop offset="1" stopColor="#06504D" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF4C9" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF0B8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFF0B8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}-sky)`} />
      <g fill="#FFFFFF" opacity="0.7">
        <circle cx="120" cy="24" r="1" />
        <circle cx="200" cy="16" r="1.2" />
        <circle cx="280" cy="30" r="0.9" />
        <circle cx="300" cy="62" r="0.8" />
      </g>
      <circle cx="236" cy="108" r="52" fill={`url(#${id}-sun)`} />
      <circle cx="236" cy="108" r="19" fill="#FFE9AE" />
      <path d="M0 120 H320 V200 H0 Z" fill={`url(#${id}-sea)`} />
      <g stroke="#FFE9AE" strokeWidth="2" strokeLinecap="round" opacity="0.6">
        <path d="M222 126 h28" />
        <path d="M214 134 h44" />
        <path d="M226 142 h20" />
        <path d="M218 150 h34" />
      </g>
      <path d="M0 92 C18 88 36 90 50 98 C66 106 76 116 88 125 C98 132 102 144 106 152 L106 200 L0 200 Z" fill="#06403E" />
      <path d="M0 108 C16 106 30 110 42 118 C56 128 64 140 72 152 L72 200 L0 200 Z" fill="#05322F" />
      <path d="M44 42 L168 18 L168 70 Z" fill={`url(#${id}-beam)`} />
      <circle cx="40" cy="44" r="12" fill="#FFF0B8" opacity="0.3" />
      <path d="M33 96 L47 96 L44.2 52 L35.8 52 Z" fill="#FFF8EC" />
      <path d="M35 64 L45 64 L45.5 72 L34.5 72 Z M34.1 82 L45.9 82 L46.4 90 L33.6 90 Z" fill="#F0694C" />
      <rect x="32.5" y="48" width="15" height="4" rx="1" fill="#0A3A4E" />
      <rect x="35.5" y="39" width="9" height="9" rx="1.5" fill="#FFE9AE" />
      <path d="M34 39 L40 31 L46 39 Z" fill="#F0694C" />
      <path d="M262 146 L294 146 L288 154 L268 154 Z" fill="#05322F" />
      <path d="M277 145 V120 L292 143 Z" fill="#FFF8EC" />
      <path d="M275 145 V126 L264 143 Z" fill="#F7D88D" />
      <path d="M96 160 C116 152 136 152 156 160 C176 168 196 168 216 160 C236 152 256 152 276 160 C292 166 306 166 320 162 V200 H96 Z" fill="#0A6E69" />
      <path d="M60 178 C84 170 108 170 132 178 C156 186 180 186 204 178 C228 170 252 170 276 178 C292 183 306 184 320 182 V200 H60 Z" fill="#06504D" />
      <g stroke="#E6FFF8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.55">
        <path d="M120 158 q8 -4 16 0" />
        <path d="M196 166 q8 -4 16 0" />
        <path d="M150 180 q8 -4 16 0" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M150 72 q5 -5 10 0 q5 -5 10 0" />
        <path d="M180 56 q4 -4 8 0 q4 -4 8 0" />
      </g>
    </>
  );
}

function Castle({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4E1D4A" />
          <stop offset="0.5" stopColor="#C34C58" />
          <stop offset="1" stopColor="#FFB27A" />
        </linearGradient>
        <linearGradient id={`${id}-road`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFE2B2" />
          <stop offset="1" stopColor="#F7B887" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}-sky)`} />
      <circle cx="104" cy="122" r="44" fill="#FFD9A0" opacity="0.35" />
      <circle cx="104" cy="122" r="28" fill="#FFE3AE" />
      <g fill="#FFFFFF" opacity="0.65">
        <circle cx="40" cy="26" r="1" />
        <circle cx="250" cy="20" r="1.2" />
        <circle cx="182" cy="40" r="0.9" />
      </g>
      <path d="M0 130 C50 112 92 114 142 126 C192 138 232 112 320 118 V200 H0 Z" fill="#A23E58" />
      <g fill="#6A2445">
        <rect x="206" y="94" width="34" height="28" />
        <rect x="198" y="84" width="12" height="38" />
        <rect x="236" y="80" width="12" height="42" />
        <path d="M197 84 L204 70 L211 84 Z" />
        <path d="M235 80 L242 64 L249 80 Z" />
        <rect x="215" y="74" width="16" height="22" />
        <path d="M214 74 L223 56 L232 74 Z" />
      </g>
      <path d="M223 56 V46 L232 49 L223 52" stroke="#6A2445" strokeWidth="1.4" fill="#F7D88D" />
      <g fill="#FFD27A">
        <rect x="220" y="80" width="6" height="8" rx="3" />
        <rect x="240" y="92" width="4" height="7" rx="2" />
        <rect x="202" y="96" width="4" height="7" rx="2" />
        <path d="M218 122 V112 a5 5 0 0 1 10 0 V122 Z" />
      </g>
      <path d="M0 152 C60 134 110 140 160 150 C210 160 260 142 320 148 V200 H0 Z" fill="#7E2D4B" />
      <path d="M112 200 C124 182 160 176 164 162 C167 152 196 138 218 122 L226 122 C206 138 186 152 186 162 C186 178 160 186 176 200 Z" fill={`url(#${id}-road)`} opacity="0.92" />
      <path d="M0 178 C60 164 100 168 150 178 C200 188 260 172 320 176 V200 H0 Z" fill="#5A1F3C" />
      <g fill="#4A1733">
        <circle cx="38" cy="154" r="14" />
        <rect x="36" y="162" width="4" height="16" />
        <circle cx="66" cy="160" r="10" />
        <rect x="64.5" y="166" width="3" height="12" />
        <circle cx="282" cy="150" r="13" />
        <rect x="280" y="158" width="4" height="16" />
        <circle cx="304" cy="158" r="9" />
        <rect x="302.6" y="163" width="2.8" height="12" />
      </g>
      <g stroke="#4A1733" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M150 52 q5 -5 10 0 q5 -5 10 0" />
        <path d="M172 66 q4 -4 8 0 q4 -4 8 0" />
      </g>
    </>
  );
}

function Manor({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#100B36" />
          <stop offset="0.6" stopColor="#3A2C8C" />
          <stop offset="1" stopColor="#7A63EE" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#E9E2FF" stopOpacity="0.6" />
          <stop offset="1" stopColor="#E9E2FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}-sky)`} />
      <g fill="#FFFFFF">
        <circle cx="30" cy="30" r="1.1" opacity="0.8" />
        <circle cx="72" cy="58" r="0.8" opacity="0.6" />
        <circle cx="120" cy="22" r="1.2" opacity="0.9" />
        <circle cx="160" cy="48" r="0.8" opacity="0.6" />
        <circle cx="290" cy="22" r="1" opacity="0.8" />
        <circle cx="300" cy="96" r="0.8" opacity="0.6" />
      </g>
      <circle cx="226" cy="58" r="58" fill={`url(#${id}-glow)`} />
      <circle cx="226" cy="58" r="28" fill="#F4EFFF" />
      <g fill="#D9CFFF" opacity="0.75">
        <circle cx="216" cy="50" r="5" />
        <circle cx="234" cy="66" r="3.5" />
        <circle cx="232" cy="46" r="2.2" />
      </g>
      <path d="M248 40 q4 -6 8 -1 q2 -3 4 0 q2 -3 4 0 q4 -5 8 1 q-6 -1 -8 4 q-2 -2 -4 0 q-2 -2 -4 0 q-2 -5 -8 -4 Z" fill="#1A1250" />
      <path d="M0 168 C80 158 160 162 240 168 C280 171 300 168 320 166 V200 H0 Z" fill="#160F45" />
      <g fill="#0F0A2E">
        <path d="M96 176 V118 L128 90 L160 118 V176 Z" />
        <path d="M160 176 V128 H226 V176 Z" />
        <path d="M196 128 V92 L210 74 L224 92 V128 Z" />
        <rect x="104" y="84" width="8" height="20" />
        <path d="M156 128 L193 104 L230 128 Z" />
      </g>
      <g fill="#2A2066">
        <rect x="112" y="128" width="10" height="14" rx="1" />
        <rect x="134" y="128" width="10" height="14" rx="1" />
        <rect x="170" y="140" width="9" height="13" rx="1" />
        <rect x="190" y="140" width="9" height="13" rx="1" />
      </g>
      <path d="M205 112 V102 a5 5 0 0 1 10 0 V112 Z" fill="#FFD27A" />
      <circle cx="210" cy="106" r="11" fill="#FFD27A" opacity="0.25" />
      <path d="M122 176 V160 a6 6 0 0 1 12 0 V176 Z" fill="#FFD27A" opacity="0.85" />
      <g fill="#FFFFFF" opacity="0.1">
        <ellipse cx="80" cy="182" rx="90" ry="10" />
        <ellipse cx="250" cy="186" rx="100" ry="9" />
      </g>
      <g fill="#0B0726">
        {Array.from({ length: 14 }, (_, index) => (
          <rect key={index} x={10 + index * 22} y="178" width="3" height="22" />
        ))}
        <rect x="0" y="184" width="320" height="3" />
      </g>
      <circle cx="268" cy="146" r="25" fill="#FFFFFF" fillOpacity="0.12" stroke="#F6D58A" strokeWidth="6" />
      <path d="M287 164 L305 186" stroke="#F6D58A" strokeWidth="9" strokeLinecap="round" />
      <path d="M254 134 a18 18 0 0 1 14 -7" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <text x="268" y="157" textAnchor="middle" fontFamily="'Fraunces Variable', Georgia, serif" fontStyle="italic" fontWeight="600" fontSize="30" fill="#FFE7A6">?</text>
    </>
  );
}

function Workshop({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.72" cy="0.25" r="0.95">
          <stop offset="0" stopColor="#FFE9AE" />
          <stop offset="0.45" stopColor="#F2A93B" />
          <stop offset="1" stopColor="#8A4B0B" />
        </radialGradient>
        <linearGradient id={`${id}-feather`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3E2BF" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF0B8" />
          <stop offset="1" stopColor="#FFD460" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}-bg)`} />
      <path d="M0 158 H320 V200 H0 Z" fill="#6B3A0C" opacity="0.55" />
      <path d="M0 158 H320" stroke="#FFE2A4" strokeOpacity="0.35" strokeWidth="1.5" />
      <g>
        <rect x="22" y="146" width="82" height="13" rx="2" fill="#7C62F5" />
        <rect x="28" y="133" width="72" height="13" rx="2" fill="#12A39A" />
        <rect x="18" y="120" width="86" height="13" rx="2" fill="#F0694C" />
        <path d="M30 152.5 h56 M36 139.5 h50 M26 126.5 h58" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.5" />
      </g>
      <g fill="#8A5A1B" opacity="0.55">
        <rect x="118" y="104" width="22" height="7" rx="3.5" />
        <rect x="146" y="104" width="14" height="7" rx="3.5" />
        <rect x="166" y="104" width="26" height="7" rx="3.5" />
      </g>
      <g fill={`url(#${id}-gold)`}>
        <rect x="118" y="122" width="30" height="8" rx="4" />
        <rect x="154" y="122" width="22" height="8" rx="4" />
        <rect x="182" y="122" width="36" height="8" rx="4" />
      </g>
      <path d="M150 110 C150 116 150 116 150 118" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M296 14 C250 26 200 64 168 112 L163 121 L173 115 C220 88 266 54 302 20 Z" fill={`url(#${id}-feather)`} />
      <path d="M300 18 C254 46 206 82 166 118" stroke="#D8A64A" strokeWidth="2" fill="none" />
      <g stroke="#E7C98D" strokeWidth="1.2" strokeLinecap="round">
        <path d="M266 34 L276 46" />
        <path d="M246 48 L256 60" />
        <path d="M226 62 L236 74" />
        <path d="M206 78 L214 88" />
        <path d="M262 44 L250 40" />
        <path d="M240 58 L228 54" />
      </g>
      <path d="M160 118 L168 112 L174 120 L163 130 Z" fill="#3B2A12" />
      <path d="M163 130 C158 134 150 133 146 128" stroke="#3B2A12" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <g fill="#FFFFFF">
        <path className="ws-star-twinkle" d={sparklePath(226, 110, 6)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '1s' }} d={sparklePath(204, 140, 4)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '1.8s' }} d={sparklePath(250, 132, 3.5)} />
      </g>
      <g fill="#FFF3C8">
        <path className="ws-star-twinkle" style={{ animationDelay: '0.5s' }} d={sparklePath(60, 40, 5)} />
        <path className="ws-star-twinkle" style={{ animationDelay: '2.4s' }} d={sparklePath(110, 66, 3.5)} />
      </g>
    </>
  );
}
