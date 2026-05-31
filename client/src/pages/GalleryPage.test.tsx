import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GalleryPage from './GalleryPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GalleryPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('renders image-bearing tiles linking to setting detail', async () => {
    vi.mocked(api).mockResolvedValue({
      items: [
        {
          uuid: 'gallery-uuid-1',
          title: 'Birch cut result',
          power: 30,
          speed: 300,
          vote_score: 7,
          material_name: 'Birch Plywood',
          device_name: 'F2 Ultra',
          image: { card_path: 'abc-card.jpg', thumbnail_path: null, stored_path: null, caption: null },
        },
      ],
      page: 1,
      limit: 36,
      total: 1,
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Birch cut result')).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /Birch cut result/ });
    expect(link).toHaveAttribute('href', '/settings/gallery-uuid-1');
    const img = screen.getByAltText('Birch cut result') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/uploads/abc-card.jpg');
  });

  it('shows an empty state when there are no results', async () => {
    vi.mocked(api).mockResolvedValue({ items: [], page: 1, limit: 36, total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No result photos yet/)).toBeInTheDocument());
  });
});
