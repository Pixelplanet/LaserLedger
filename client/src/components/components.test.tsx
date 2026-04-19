import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { EmptyState, ErrorBlock, LoadingBlock } from './States';

describe('Button', () => {
  it('renders primary + sm classes', () => {
    render(
      <Button variant="primary" size="sm">
        Save
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toHaveClass('btn');
    expect(btn).toHaveClass('primary');
    expect(btn).toHaveClass('sm');
  });
});

describe('States', () => {
  it('renders loading/empty/error blocks', () => {
    render(
      <>
        <LoadingBlock>Loading data</LoadingBlock>
        <EmptyState>No rows</EmptyState>
        <ErrorBlock>Oops</ErrorBlock>
      </>,
    );
    expect(screen.getByText('Loading data')).toBeInTheDocument();
    expect(screen.getByText('No rows')).toBeInTheDocument();
    expect(screen.getByText('Oops')).toBeInTheDocument();
  });
});
