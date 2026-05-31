import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api } from '../lib/api';

interface DeviceRow {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  manufacturer_name: string | null;
  family_name: string | null;
}

export default function DevicesIndexPage() {
  const devices = useQuery({
    queryKey: ['devices-index'],
    queryFn: () => api<DeviceRow[]>('/devices'),
  });

  return (
    <PageBlock title="Devices" subtitle="Pick your machine to see what it can do and the community's best settings.">
      {devices.isLoading ? (
        <p className="hint">Loading…</p>
      ) : devices.data && devices.data.length > 0 ? (
        <div className="results-grid">
          {devices.data.map((d) => (
            <Link key={d.id} to={`/devices/${d.slug}`} className="tile">
              <div className="tile-media">
                {d.image_url ? <img src={d.image_url} alt={d.name} loading="lazy" /> : null}
              </div>
              <div className="tile-body">
                <h3 className="tile-title">{d.name}</h3>
                <div className="tile-author">
                  {[d.manufacturer_name, d.family_name].filter(Boolean).join(' · ')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">No devices listed.</div>
      )}
    </PageBlock>
  );
}
