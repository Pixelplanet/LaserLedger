import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'default' | 'warn' | 'muted';
  onClick?: () => void;
}

export function Tag({ children, variant = 'default', onClick }: Props) {
  const cls = ['tag', variant === 'warn' && 'warn', variant === 'muted' && 'muted'].filter(Boolean).join(' ');
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} style={{ cursor: 'pointer', border: 'none' }}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}
