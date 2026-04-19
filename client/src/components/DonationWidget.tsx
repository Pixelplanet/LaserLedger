import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface SystemSetting { key: string; value: string }

export function DonationWidget() {
  const settings = useQuery({
    queryKey: ['public-system'],
    queryFn: () => api<SystemSetting[]>('/system-settings'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const url = settings.data?.find((s) => s.key === 'public_donation_url')?.value;
  const label = settings.data?.find((s) => s.key === 'public_donation_label')?.value || 'Support LaserLedger';
  if (!url) return null;
  return (
    <a className="btn primary sm" href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      ❤ {label}
    </a>
  );
}
