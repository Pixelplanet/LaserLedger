import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}

export function Input({ label, hint, error, ...rest }: Props) {
  return (
    <label>
      {label}
      <input {...rest} />
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}

export function Textarea({ label, hint, error, ...rest }: TextareaProps) {
  return (
    <label>
      {label}
      <textarea {...rest} />
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}
