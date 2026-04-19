import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({ variant = 'ghost', size = 'md', children, className = '', ...rest }: Props) {
  const cls = ['btn', variant === 'primary' && 'primary', variant === 'danger' && 'danger', size === 'sm' && 'sm', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}
