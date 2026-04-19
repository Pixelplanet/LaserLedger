import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  title: ReactNode;
  to?: string;
  children?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function Card({ title, to, children, meta, className = '' }: Props) {
  const inner = (
    <>
      <h3>{title}</h3>
      {meta && <div className="meta">{meta}</div>}
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={`card ${className}`.trim()}>{inner}</Link>
  ) : (
    <div className={`card ${className}`.trim()}>{inner}</div>
  );
}
