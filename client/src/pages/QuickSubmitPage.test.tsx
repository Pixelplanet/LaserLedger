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
      if (path === '/devices') {
        return [
          { id: 1, name: 'F2 Ultra UV', laser_types: [{ id: 7, name: 'UV' }] },
          { id: 2, name: 'F2', laser_types: [{ id: 8, name: 'Infrared' }, { id: 9, name: 'Blue Diode' }] },
          { id: 3, name: 'SVG Vector Export', laser_types: [] },
        ];
      }
      if (path === '/laser-types') return [{ id: 7, name: 'UV' }, { id: 8, name: 'Infrared' }, { id: 9, name: 'Blue Diode' }];
      if (path === '/materials') {
        return [
          { id: 3, name: 'Birch Plywood', slug: 'birch-plywood', thickness_mm: 3, category_name: 'Wood' },
          { id: 4, name: 'Anodized Aluminum', slug: 'anodized-aluminum', category_name: 'Metals' },
          { id: 999, name: 'Custom material', slug: 'custom-material', category_name: 'Other' },
        ];
      }
      if (path === '/operation-types') return [{ id: 2, name: 'Cut' }];
      if (path === '/settings') return { uuid: 'quick-uuid' };
      throw new Error(`Unexpected api path: ${path}`);
    });
  });

  it('auto-generates a title from the selections', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: /Birch Plywood/ })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Material'), '3');
    await userEvent.selectOptions(screen.getByLabelText('Device'), '2');
    await userEvent.selectOptions(screen.getByLabelText('Laser source'), '9');
    await userEvent.selectOptions(screen.getByLabelText('Operation'), '2');

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toHaveValue('Cut — Birch Plywood (3mm) — F2 / Blue Diode');
    });
  });

  it('auto-selects single laser devices and hides manual source selection', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: /F2 Ultra UV/ })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Device'), '1');

    expect(screen.queryByRole('combobox', { name: /Laser source/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Laser source/i })).toHaveValue('UV');
  });

  it('submits a minimal setting and navigates to the edit screen', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: /Birch Plywood/ })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Material'), '3');
    await userEvent.selectOptions(screen.getByLabelText('Device'), '2');
    await userEvent.selectOptions(screen.getByLabelText('Laser source'), '9');
    await userEvent.selectOptions(screen.getByLabelText('Operation'), '2');
    await userEvent.type(screen.getByLabelText('Power (%)'), '30');
    await userEvent.type(screen.getByLabelText('Speed (mm/s)'), '300');
    await userEvent.type(screen.getByLabelText('Frequency (kHz)'), '18');
    await userEvent.type(screen.getByLabelText('Defocus (mm)'), '-0.2');
    await userEvent.type(screen.getByLabelText('Notes for moderators/users (optional)'), 'Worked cleanly in one pass.');
    await userEvent.click(screen.getByRole('button', { name: 'Save setting' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/settings/quick-uuid/edit');
    });
    const postCall = vi.mocked(api).mock.calls.find((c) => c[0] === '/settings');
    expect(postCall).toBeTruthy();
    const body = (postCall![1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      title: 'Cut — Birch Plywood (3mm) — F2 / Blue Diode',
      device_id: 2,
      laser_type_id: 9,
      material_id: 3,
      operation_type_id: 2,
      power: 30,
      speed: 300,
      passes: 1,
      frequency: 18,
      focus_offset: -0.2,
      result_description: 'Worked cleanly in one pass.',
    });
  });

  it('allows custom material input and maps it to fallback material id', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('option', { name: /Custom material/ })).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Device'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Operation'), '2');
    await userEvent.type(screen.getByLabelText(/Custom material/i), 'Powder-coated brass');
    await userEvent.click(screen.getByRole('button', { name: 'Save setting' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/settings/quick-uuid/edit');
    });

    const postCall = vi.mocked(api).mock.calls.find((c) => c[0] === '/settings');
    expect(postCall).toBeTruthy();
    const body = (postCall![1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      material_id: 999,
      result_description: 'Custom material: Powder-coated brass',
    });
  });
});
