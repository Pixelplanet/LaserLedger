import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function LoadingBlock({ children = 'Loading…' }: { children?: ReactNode }) {
  return <p className="hint">{children}</p>;
}

export function ErrorBlock({ children }: { children: ReactNode }) {
  return <p className="err">{children}</p>;
}
