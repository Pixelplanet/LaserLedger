import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuickSubmitPage from './QuickSubmitPage';
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuickSubmitPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('QuickSubmitPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(api).mockReset();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/devices') return [{ id: 1, name: 'F2 Ultra', laser_types: [{ id: 7, name: 'Blue 10W' }] }];
      if (path === '/laser-types') return [{ id: 7, name: 'Blue 10W' }];
      if (path === '/materials') return [{ id: 3, name: 'Birch Plywood', thickness_mm: 3 }];
      if (path === '/operation-types') return [{ id: 2, name: 'Cut' }];
      if (path === '/settings') return { uuid: 'quick-uuid' };
      throw new Error(`Unexpected api path: ${path}`);
    });
  });

  it('auto-generates a title from the selections', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: /Birch Plywood/ })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Material'), '3');
    await userEvent.selectOptions(screen.getByLabelText('Device'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Laser'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Operation'), '2');

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toHaveValue('Cut — Birch Plywood (3mm) — F2 Ultra / Blue 10W');
    });
  });

  it('submits a minimal recipe and navigates to the edit screen', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: /Birch Plywood/ })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Material'), '3');
    await userEvent.selectOptions(screen.getByLabelText('Device'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Laser'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Operation'), '2');
    await userEvent.type(screen.getByLabelText('Power (%)'), '30');
    await userEvent.type(screen.getByLabelText('Speed (mm/s)'), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/settings/quick-uuid/edit');
    });
    const postCall = vi.mocked(api).mock.calls.find((c) => c[0] === '/settings');
    expect(postCall).toBeTruthy();
    const body = (postCall![1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      title: 'Cut — Birch Plywood (3mm) — F2 Ultra / Blue 10W',
      device_id: 1,
      laser_type_id: 7,
      material_id: 3,
      operation_type_id: 2,
      power: 30,
      speed: 300,
      passes: 1,
    });
  });
});
