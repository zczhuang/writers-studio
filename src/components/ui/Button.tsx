import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-sans font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold-bright',
  gold: 'bg-gradient-to-br from-gold-bright via-gold to-gold-deep text-ink hover:brightness-110 shadow-gold-glow',
  ghost: 'bg-transparent text-text border border-text-faint/40 hover:bg-surface-2 hover:border-text-faint',
  subtle: 'bg-surface text-text hover:bg-surface-2',
  danger: 'bg-rust text-paper hover:bg-rust/90',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-2 text-caption min-h-[40px]',
  md: 'px-5 py-3 text-body min-h-[48px]',
  lg: 'px-6 py-4 text-body min-h-[56px]',
};

export function Button({ variant = 'primary', size = 'md', fullWidth, children, className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
