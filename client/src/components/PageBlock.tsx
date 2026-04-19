import type { PropsWithChildren } from 'react';

type PageBlockProps = PropsWithChildren<{ title: string; subtitle?: string }>;

export default function PageBlock({ title, subtitle, children }: PageBlockProps) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  );
}
