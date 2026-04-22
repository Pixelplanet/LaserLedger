import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SubmitPage from './SubmitPage';
import { api } from '../lib/api';

const navigateMock = vi.fn();

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('SubmitPage', () => {
  it('navigates to the edit screen after create so images can be uploaded immediately', async () => {
    vi.mocked(api)
      .mockImplementation(async (path: string) => {
        if (path === '/devices') return [{ id: 1, name: 'F2 Ultra (UV)' }];
        if (path === '/laser-types') return [{ id: 1, name: 'UV' }];
        if (path === '/materials') return [{ id: 1, name: '304 Stainless Steel' }];
        if (path === '/operation-types') return [{ id: 1, name: 'Engrave' }];
        if (path === '/settings') return { uuid: 'new-setting-uuid' };
        throw new Error(`Unexpected api path: ${path}`);
      });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SubmitPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText('Title'), 'Test submission');
    await userEvent.selectOptions(screen.getByLabelText('Device'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Laser type'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Material'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Operation'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/settings/new-setting-uuid/edit');
    });
  });
});