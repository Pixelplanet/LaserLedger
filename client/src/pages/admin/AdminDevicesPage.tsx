import { useState } from 'react';
import PageBlock from '../../components/PageBlock';
import { CrudTable } from '../../components/CrudTable';
import { ErrorBlock } from '../../components/States';

interface Device { id: number; name: string; slug: string; family_id: number | null; ext_id: string | null }
interface Family { id: number; name: string; slug: string; manufacturer_id: number | null }
interface Manufacturer { id: number; name: string; slug: string; website: string | null }
interface LaserTypeMatch { id: number; name: string; slug: string }
interface ParsedImport {
  parsed: {
    ext_id: string | null;
    ext_name: string | null;
    light_source: string | null;
  };
  existing_device: Device | null;
  matching_laser_types: LaserTypeMatch[];
  suggested_name: string;
}

export default function AdminDevicesPage() {
  const [importData, setImportData] = useState<ParsedImport | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [createFormVersion, setCreateFormVersion] = useState(0);

  async function onImport(file: File) {
    setImportBusy(true);
    setImportErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/devices/parse-xcs', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'XCS parse failed');
      setImportData(json.data as ParsedImport);
      setCreateFormVersion((current) => current + 1);
    } catch (error) {
      setImportErr(error instanceof Error ? error.message : 'XCS parse failed');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <PageBlock title="Devices, families & manufacturers" subtitle="Reference data for hardware.">
      <div className="form" style={{ marginBottom: '1.5rem' }}>
        <h2>Import device metadata from XCS</h2>
        <label>
          Upload .xcs file
          <input
            type="file"
            accept=".xcs,application/json"
            disabled={importBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
            }}
          />
        </label>
        <p className="hint">This extracts the XCS extId and suggested device name, then prefills the device form below. You still choose the family ID manually.</p>
        {importErr && <ErrorBlock>{importErr}</ErrorBlock>}
        {importData && (
          <div className="card">
            <h3>Extracted device data</h3>
            <div className="meta">Suggested name: {importData.suggested_name}</div>
            <div className="meta">XCS extId: {importData.parsed.ext_id ?? 'not found'}</div>
            <div className="meta">XCS extName: {importData.parsed.ext_name ?? 'not found'}</div>
            <div className="meta">Light source: {importData.parsed.light_source ?? 'not found'}</div>
            <div className="meta">
              Suggested laser types: {importData.matching_laser_types.length > 0
                ? importData.matching_laser_types.map((laser) => laser.name).join(', ')
                : 'no match'}
            </div>
            {importData.existing_device && (
              <div className="meta">Existing device with this extId: {importData.existing_device.name}</div>
            )}
          </div>
        )}
      </div>

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
          { key: 'ext_name', label: 'XCS extName' },
          { key: 'description', label: 'Description', type: 'textarea' },
        ]}
        displayColumns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'Slug' },
          { key: 'ext_id', label: 'extId' },
        ]}
        createInitialValues={importData ? {
          name: importData.suggested_name,
          ext_id: importData.parsed.ext_id,
          ext_name: importData.parsed.ext_name ?? importData.suggested_name,
        } : null}
        createFormVersion={createFormVersion}
      />
    </PageBlock>
  );
}
