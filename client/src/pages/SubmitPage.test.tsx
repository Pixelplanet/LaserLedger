import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SubmitPage from './SubmitPage';
import { api } from '../lib/api';
import { uploadFileWithProgress } from '../lib/upload-progress';

const navigateMock = vi.fn();

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock('../lib/upload-progress', () => ({
  uploadFileWithProgress: vi.fn(),
  formatBytesPerSecond: (bytesPerSecond: number | null) => bytesPerSecond === null ? 'calculating' : `${bytesPerSecond} B/s`,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('SubmitPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(api).mockReset();
    vi.mocked(uploadFileWithProgress).mockReset();
  });

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

  it('autofills settings from the first parsed XCS layer', async () => {
    vi.mocked(api)
      .mockImplementation(async (path: string) => {
        if (path === '/devices') return [{ id: 1, name: 'F2 Ultra (UV)' }];
        if (path === '/laser-types') return [{ id: 1, name: 'UV' }];
        if (path === '/materials') return [{ id: 1, name: '304 Stainless Steel' }];
        if (path === '/operation-types') return [{ id: 1, name: 'Engrave' }];
        throw new Error(`Unexpected api path: ${path}`);
      });
    vi.mocked(uploadFileWithProgress).mockImplementation(async (_url, _fieldName, _file, onProgress) => {
      onProgress({ phase: 'uploading', uploadPercent: 50, parsePercent: 0, speedBytesPerSecond: 1024, elapsedMs: 500 });
      onProgress({ phase: 'parsing', uploadPercent: 100, parsePercent: 40, speedBytesPerSecond: 1024, elapsedMs: 800 });
      return {
        parsed: {
          layers: [{ power: 42, speed: 1200, passes: 2, frequency: 30, lpi: 254, pulse_width: 100, scan_mode: 'lineMode' }],
        },
        resolved: { device: { id: 1 }, material: { id: 1 } },
        warnings: ['Unknown laser type; choose one manually.'],
      };
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

    const file = new File(['{}'], 'setting.xcs', { type: 'application/json' });
    await userEvent.upload(screen.getByLabelText('Import from xTool Studio (.xs) or Creative Space (.xcs)'), file);

    await waitFor(() => {
      expect(screen.getByLabelText('Power (%)')).toHaveValue(42);
      expect(screen.getByLabelText('Speed (mm/s)')).toHaveValue(1200);
      expect(screen.getByLabelText('Passes')).toHaveValue(2);
      expect(screen.getByLabelText('Frequency (kHz)')).toHaveValue(30);
      expect(screen.getByText(/Unknown laser type; choose one manually\./)).toBeInTheDocument();
    });
  });
});