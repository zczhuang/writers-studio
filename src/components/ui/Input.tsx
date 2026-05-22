import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className = '', ...rest }: Props) {
  return (
    <label className="block">
      {label && <div className="mb-1.5 text-caption font-medium text-text-muted">{label}</div>}
      <input
        {...rest}
        className={`w-full bg-surface text-text placeholder:text-text-faint border border-white/10 rounded-lg px-4 py-3 font-sans text-body focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/20 ${className}`}
      />
      {hint && !error && <div className="mt-1 text-caption text-text-faint">{hint}</div>}
      {error && <div className="mt-1 text-caption text-rust">{error}</div>}
    </label>
  );
}
