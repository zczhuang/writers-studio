import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'gold' | 'night' | 'ghost' | 'ghost-light' | 'subtle' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'ws-btn--gold',
  gold: 'ws-btn--gold',
  night: 'ws-btn--night',
  ghost: 'ws-btn--ghost',
  'ghost-light': 'ws-btn--ghost-light',
  subtle: 'ws-btn--subtle',
  danger: 'ws-btn--danger',
  'danger-ghost': 'ws-btn--danger-ghost',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'ws-btn--sm',
  md: '',
  lg: 'ws-btn--lg',
};

export function Button({ variant = 'gold', size = 'md', fullWidth, children, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      {...rest}
      className={['ws-btn', VARIANT_CLASS[variant], SIZE_CLASS[size], fullWidth ? 'ws-btn--block' : '', className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
