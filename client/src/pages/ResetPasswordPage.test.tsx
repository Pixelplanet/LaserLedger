import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from './ResetPasswordPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

describe('ResetPasswordPage', () => {
  it('submits token and new_password to the reset endpoint', async () => {
    vi.mocked(api).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/reset-password/reset-token-12345']}>
        <Routes>
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText('New password (8+ chars)'), 'NewSecret1!');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(api).toHaveBeenCalledWith('/auth/reset-password', {
      method: 'POST',
      body: { token: 'reset-token-12345', new_password: 'NewSecret1!' },
    });
  });
});