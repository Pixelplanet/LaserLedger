import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api } from '../lib/api';

interface DeviceInfo {
  id: number;
  name: string;
  slug: string;
  ext_id: string | null;
  description: string | null;
  image_url: string | null;
  product_url: string | null;
  workspace_width: number | null;
  workspace_height: number | null;
  family_name: string | null;
  manufacturer_name: string | null;
}
interface LaserType {
  id: number;
  name: string;
  slug: string;
  light_source: string;
  wavelength_nm: number | null;
  is_default: boolean;
  power_watts: unknown;
}
interface BestSetting {
  uuid: string;
  title: string;
  power: number | null;
  speed: number | null;
  passes: number | null;
  vote_score: number;
  quality_rating: number | null;
  material_id: number;
  material_name: string;
  thickness_mm: number | null;
  operation_type_id: number;
  operation_name: string;
  laser_name: string;
}
interface DeviceOverview {
  device: DeviceInfo;
  laser_types: LaserType[];
  best_settings: BestSetting[];
  stats: { approved_settings: number; materials_covered: number };
}

export default function DevicePage() {
  const { slug } = useParams<{ slug: string }>();
  const overview = useQuery({
    queryKey: ['device-overview', slug],
    queryFn: () => api<DeviceOverview>(`/devices/${slug}/overview`),
    enabled: !!slug,
    retry: false,
  });

  if (overview.isLoading) return <p className="hint">Loading…</p>;
  if (overview.isError || !overview.data) {
    return (
      <PageBlock title="Device not found" subtitle="We couldn't find that machine.">
        <Link className="cta" to="/devices">All devices</Link>
      </PageBlock>
    );
  }

  const { device, laser_types, best_settings, stats } = overview.data;
  const heroTitle = `${device.name} laser settings`;

  return (
    <PageBlock
      title={heroTitle}
      subtitle={[device.manufacturer_name, device.family_name].filter(Boolean).join(' · ') || undefined}
    >
      <div className="grid" style={{ gridTemplateColumns: device.image_url ? '1fr 2fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {device.image_url && (
          <img src={device.image_url} alt={device.name} style={{ width: '100%', borderRadius: 12 }} loading="lazy" />
        )}
        <div>
          {device.description && <p>{device.description}</p>}
          <ul className="meta-list">
            {device.workspace_width != null && device.workspace_height != null && (
              <li>Workspace: {device.workspace_width} × {device.workspace_height} mm</li>
            )}
            <li>{stats.approved_settings} approved settings · {stats.materials_covered} materials covered</li>
          </ul>
          {device.product_url && (
            <a className="nav-link" href={device.product_url} target="_blank" rel="noopener noreferrer">
              Manufacturer page →
            </a>
          )}
        </div>
      </div>

      <div className="section-head"><h2>Supported lasers</h2></div>
      <div className="tile-meta">
        {laser_types.length > 0 ? (
          laser_types.map((l) => (
            <span key={l.id} className={`tag ${l.is_default ? 'solid' : 'muted'}`}>
              {l.name}
              {l.wavelength_nm ? ` (${l.wavelength_nm}nm)` : ''}
            </span>
          ))
        ) : (
          <span className="hint">No laser modules listed.</span>
        )}
      </div>

      <div className="section-head"><h2>Best settings by material</h2></div>
      {best_settings.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Operation</th>
              <th>Laser</th>
              <th>Power</th>
              <th>Speed</th>
              <th>Passes</th>
              <th>Votes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {best_settings.map((s) => (
              <tr key={s.uuid}>
                <td>{s.material_name}{s.thickness_mm != null ? ` (${s.thickness_mm}mm)` : ''}</td>
                <td>{s.operation_name}</td>
                <td>{s.laser_name}</td>
                <td>{s.power != null ? `${s.power}%` : '—'}</td>
                <td>{s.speed != null ? `${s.speed} mm/s` : '—'}</td>
                <td>{s.passes ?? '—'}</td>
                <td>▲ {s.vote_score}</td>
                <td><Link to={`/settings/${s.uuid}`}>View →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">No approved settings for this device yet.</div>
      )}
    </PageBlock>
  );
}
