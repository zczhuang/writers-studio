import { useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className = '', id, ...rest }: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="ws-field">
      {label && <label className="ws-field-label" htmlFor={inputId}>{label}</label>}
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`ws-input ${className}`}
      />
      {hint && !error && <div id={`${inputId}-hint`} className="ws-field-hint">{hint}</div>}
      {error && <div id={`${inputId}-error`} className="ws-field-error">{error}</div>}
    </div>
  );
}
