import PageBlock from '../../components/PageBlock';
import { CrudTable } from '../../components/CrudTable';

interface Device { id: number; name: string; slug: string; family_id: number | null; ext_id: string | null }
interface Family { id: number; name: string; slug: string; manufacturer_id: number | null }
interface Manufacturer { id: number; name: string; slug: string; website: string | null }

export default function AdminDevicesPage() {
  return (
    <PageBlock title="Devices, families & manufacturers" subtitle="Reference data for hardware.">
      <h2>Manufacturers</h2>
      <CrudTable<Manufacturer>
        endpoint="/admin/manufacturers"
        queryKey="admin-manufacturers"
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'website', label: 'Website' },
          { key: 'description', label: 'Description', type: 'textarea' },
        ]}
        displayColumns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'Slug' },
          { key: 'website', label: 'Website' },
        ]}
      />
      <h2 style={{ marginTop: '1.5rem' }}>Device families</h2>
      <CrudTable<Family>
        endpoint="/admin/device-families"
        queryKey="admin-families"
        fields={[
          { key: 'manufacturer_id', label: 'Manufacturer ID', type: 'number', required: true },
          { key: 'name', label: 'Name', required: true },
          { key: 'description', label: 'Description', type: 'textarea' },
        ]}
        displayColumns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'Slug' },
          { key: 'manufacturer_id', label: 'Mfr' },
        ]}
      />
      <h2 style={{ marginTop: '1.5rem' }}>Devices</h2>
      <CrudTable<Device>
        endpoint="/admin/devices"
        queryKey="admin-devices"
        fields={[
          { key: 'family_id', label: 'Family ID', type: 'number', required: true },
          { key: 'name', label: 'Name', required: true },
          { key: 'ext_id', label: 'XCS extId' },
          { key: 'description', label: 'Description', type: 'textarea' },
        ]}
        displayColumns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'Slug' },
          { key: 'ext_id', label: 'extId' },
        ]}
      />
    </PageBlock>
  );
}
