interface Props {
  compact?: boolean;
}

/** A small local illustration for the atlas metaphor. No remote artwork or image fetches. */
export function AtlasIllustration({ compact = false }: Props) {
  return (
    <svg
      className={compact ? 'atlas-illustration atlas-illustration-compact' : 'atlas-illustration'}
      viewBox="0 0 520 320"
      role="img"
      aria-label="An open storybook floating above a small illustrated landscape"
    >
      <defs>
        <linearGradient id="atlas-sky" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--atlas-teal-deep)" />
          <stop offset="1" stopColor="var(--atlas-teal)" />
        </linearGradient>
        <linearGradient id="atlas-paper" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#f3e8cf" />
        </linearGradient>
        <filter id="atlas-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <path d="M41 230c33-74 109-119 210-117 105 2 187 50 228 117v41H41Z" fill="url(#atlas-sky)" opacity="0.14" />
      <path d="M51 236c43-47 91-63 143-46 43 14 68 8 105-19 49-36 109-17 168 66v22H51Z" fill="var(--atlas-lilac)" opacity="0.48" />
      <path d="M50 248c45-27 79-29 120-11 35 15 71 13 106-7 59-34 115-13 189 47H50Z" fill="var(--atlas-coral)" opacity="0.64" />
      <path d="M51 271c50-13 83-9 126 5 41 13 82 9 117-4 52-19 106-8 171 20H51Z" fill="var(--atlas-moss)" opacity="0.84" />

      <g fill="var(--atlas-gold)" opacity="0.82">
        <circle cx="104" cy="81" r="2.8" />
        <circle cx="145" cy="48" r="2" />
        <circle cx="381" cy="67" r="2.5" />
        <circle cx="433" cy="113" r="1.7" />
        <path d="m333 42 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" />
        <path d="m188 91 2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2Z" />
      </g>

      <ellipse cx="260" cy="264" rx="143" ry="20" fill="var(--atlas-teal-deep)" opacity="0.22" filter="url(#atlas-shadow)" />

      <g className="atlas-book" stroke="var(--atlas-ink)" strokeLinejoin="round">
        <path d="M111 172c43-17 91-14 149 10v81c-56-23-105-25-149-8Z" fill="url(#atlas-paper)" strokeWidth="3" />
        <path d="M409 172c-43-17-91-14-149 10v81c56-23 105-25 149-8Z" fill="url(#atlas-paper)" strokeWidth="3" />
        <path d="M260 182v81" fill="none" strokeWidth="3" />
        <path d="M133 193c34-9 70-6 107 8M133 211c32-8 65-6 99 5M387 193c-34-9-70-6-107 8M387 211c-32-8-65-6-99 5" fill="none" stroke="var(--atlas-teal)" strokeLinecap="round" strokeWidth="3" opacity="0.64" />
        <path d="M159 159c31-27 66-35 101-22v45c-39-14-73-11-101 4Z" fill="var(--atlas-coral)" opacity="0.82" strokeWidth="2.5" />
        <path d="M361 159c-31-27-66-35-101-22v45c39-14 73-11 101 4Z" fill="var(--atlas-lilac)" opacity="0.82" strokeWidth="2.5" />
        <path d="M260 137v45" fill="none" strokeWidth="2.5" />
      </g>

      <g fill="none" stroke="var(--atlas-gold)" strokeLinecap="round" strokeWidth="2.5" opacity="0.82">
        <path d="M91 143c-11-17-9-35 7-48" />
        <path d="M429 143c11-17 9-35-7-48" />
        <path d="M83 125c-9 0-16-5-19-13M437 125c9 0 16-5 19-13" />
      </g>
      <path d="M100 275h320" stroke="var(--atlas-ink)" strokeLinecap="round" strokeWidth="2" opacity="0.18" />
    </svg>
  );
}
