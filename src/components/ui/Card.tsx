import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'surface-2' | 'paper';
  children: ReactNode;
}

const variants = {
  surface: 'bg-surface border border-white/5 shadow-card',
  'surface-2': 'bg-surface-2 border border-white/5 shadow-card',
  paper: 'bg-paper text-ink shadow-paper',
};

export function Card({ variant = 'surface', children, className = '', ...rest }: Props) {
  return (
    <div {...rest} className={`rounded-xl p-6 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
