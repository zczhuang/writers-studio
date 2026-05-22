/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        paper: 'var(--paper)',
        'paper-edge': 'var(--paper-edge)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-muted': 'var(--ink-muted)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        gold: 'var(--gold)',
        'gold-bright': 'var(--gold-bright)',
        'gold-deep': 'var(--gold-deep)',
        teal: 'var(--teal)',
        rust: 'var(--rust)',
        moss: 'var(--moss)',
        tier: {
          bronze: 'var(--tier-bronze)',
          silver: 'var(--tier-silver)',
          gold: 'var(--tier-gold)',
          platinum: 'var(--tier-platinum)',
        },
      },
      fontFamily: {
        serif: ['"Lora"', 'Georgia', 'serif'],
        display: ['"Crimson Pro"', '"Lora"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['clamp(2rem, 1.5rem + 2vw, 3.2rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        h1: ['clamp(1.6rem, 1.3rem + 1.2vw, 2.2rem)', { lineHeight: '1.2' }],
        h2: ['clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)', { lineHeight: '1.3' }],
        h3: ['1.125rem', { lineHeight: '1.4' }],
        body: ['1rem', { lineHeight: '1.6' }],
        caption: ['0.8125rem', { lineHeight: '1.4' }],
        micro: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.06em' }],
        write: ['1.125rem', { lineHeight: '1.75' }],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        paper: 'var(--shadow-paper)',
        'gold-glow': '0 0 24px rgba(212,162,76,0.35)',
      },
      animation: {
        'tier-shimmer': 'shimmer 1.8s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'shake': 'shake 0.45s cubic-bezier(.36,.07,.19,.97) both',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-110%)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateX(110%)', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        shake: {
          '10%,90%': { transform: 'translateX(-2px)' },
          '20%,80%': { transform: 'translateX(4px)' },
          '30%,50%,70%': { transform: 'translateX(-8px)' },
          '40%,60%': { transform: 'translateX(8px)' },
        },
      },
    },
  },
  plugins: [],
};
