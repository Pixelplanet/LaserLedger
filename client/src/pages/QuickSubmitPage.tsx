import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { buildRecipeTitle } from '@shared/recipe-title';

interface DeviceRow {
  id: number;
  name: string;
  laser_types?: { id: number; name: string }[];
}
interface LaserRow { id: number; name: string }
interface MaterialRow {
  id: number;
  name: string;
  slug?: string;
  thickness_mm?: number | null;
  category_name?: string | null;
}
interface OpRow { id: number; name: string }
interface CreateResp { uuid: string }

export default function QuickSubmitPage() {
  const nav = useNavigate();
  const refs = useQuery({
    queryKey: ['quick-submit-refs'],
    queryFn: async () => {
      const [devices, materials, ops] = await Promise.all([
        api<DeviceRow[]>('/devices'),
        api<MaterialRow[]>('/materials'),
        api<OpRow[]>('/operation-types'),
      ]);
      return { devices, materials, ops };
    },
  });

  const [form, setForm] = useState({
    device_id: '',
    laser_type_id: '',
    material_id: '',
    custom_material: '',
    operation_type_id: '',
    power: '',
    speed: '',
    passes: '1',
    frequency: '',
    focus_offset: '',
    result_description: '',
  });
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const devicesWithLasers = useMemo<DeviceRow[]>(
    () => refs.data?.devices.filter((d) => (d.laser_types?.length ?? 0) > 0) ?? [],
    [refs.data],
  );

  const selectedDevice = useMemo(
    () => devicesWithLasers.find((d) => String(d.id) === form.device_id),
    [devicesWithLasers, form.device_id],
  );

  const laserOptions = useMemo<LaserRow[]>(() => selectedDevice?.laser_types ?? [], [selectedDevice]);

  const showLaserSelector = laserOptions.length > 1;

  const customMaterialFallback = useMemo(
    () => refs.data?.materials.find((m) => m.slug === 'custom-material') ?? null,
    [refs.data],
  );

  const materialGroups = useMemo(() => {
    const groups = new Map<string, MaterialRow[]>();
    for (const m of refs.data?.materials ?? []) {
      const key = m.category_name?.trim() || 'Other';
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    return [...groups.entries()];
  }, [refs.data]);

  const autoTitle = useMemo(() => {
    if (!refs.data) return '';
    const device = refs.data.devices.find((d) => String(d.id) === form.device_id)?.name;
    const laser = laserOptions.find((l) => String(l.id) === form.laser_type_id)?.name;
    const selectedMaterial = refs.data.materials.find((m) => String(m.id) === form.material_id);
    const customMaterial = form.custom_material.trim();
    const material = customMaterial.length > 0 ? { name: customMaterial, thickness_mm: null } : selectedMaterial;
    const operation = refs.data.ops.find((o) => String(o.id) === form.operation_type_id)?.name;
    return buildRecipeTitle({
      operation,
      material: material?.name,
      thickness_mm: material?.thickness_mm ?? null,
      device,
      laser,
    });
  }, [
    refs.data,
    form.device_id,
    form.laser_type_id,
    form.material_id,
    form.custom_material,
    form.operation_type_id,
    laserOptions,
  ]);

  const title = titleOverride ?? autoTitle;

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<CreateResp>('/settings', { method: 'POST', body }),
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Submission failed'),
  });

  function num(v: string): number | null {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function onDeviceChange(nextDeviceId: string) {
    const device = devicesWithLasers.find((d) => String(d.id) === nextDeviceId);
    const options = device?.laser_types ?? [];
    let laserTypeId = '';
    if (options.length === 1) laserTypeId = String(options[0]!.id);
    if (options.length > 1) laserTypeId = '';
    setForm((f) => ({ ...f, device_id: nextDeviceId, laser_type_id: laserTypeId }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const customMaterial = form.custom_material.trim();
    const materialId = form.material_id
      ? Number(form.material_id)
      : customMaterial.length > 0
        ? customMaterialFallback?.id ?? null
        : null;
    if (!form.device_id || !form.laser_type_id || !materialId || !form.operation_type_id) {
      setErr('Material, device, laser, and operation are required.');
      return;
    }
    const finalTitle = title.trim();
    if (finalTitle.length < 3) {
      setErr('Could not build a title — please enter one.');
      return;
    }
    const resultDescriptionLines: string[] = [];
    if (customMaterial.length > 0) resultDescriptionLines.push(`Custom material: ${customMaterial}`);
    const notes = form.result_description.trim();
    if (notes) resultDescriptionLines.push(notes);
    const resultDescription = resultDescriptionLines.join('\n\n');

    try {
      const created = await create.mutateAsync({
        title: finalTitle,
        device_id: Number(form.device_id),
        laser_type_id: Number(form.laser_type_id),
        material_id: materialId,
        operation_type_id: Number(form.operation_type_id),
        power: num(form.power),
        speed: num(form.speed),
        passes: num(form.passes) ?? 1,
        frequency: num(form.frequency),
        focus_offset: num(form.focus_offset),
        result_description: resultDescription || null,
      });
      // Optional result photo — best-effort, non-fatal if it fails.
      if (photo) {
        try {
          const fd = new FormData();
          fd.append('image', photo);
          await fetch(`/api/settings/${created.uuid}/images`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
        } catch {
          /* photo upload is optional */
        }
      }
      nav(`/settings/${created.uuid}/edit`);
    } catch {
      /* error already surfaced via onError */
    }
  }

  return (
    <PageBlock
      title="Single setting"
      subtitle="Capture one known-good single setting in seconds. Need every field? Use the full submit form."
    >
      <form className="form quick-recipe" onSubmit={onSubmit}>
        <label>
          Material
          <select value={form.material_id} onChange={(e) => set('material_id', e.target.value)}>
            <option value="">Select…</option>
            {materialGroups.map(([group, rows]) => (
              <optgroup key={group} label={group}>
                {rows.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.thickness_mm != null ? ` (${m.thickness_mm}mm)` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label>
          Custom material (if missing in the list)
          <input
            value={form.custom_material}
            onChange={(e) => set('custom_material', e.target.value)}
            placeholder="e.g. Powder-coated brass"
            maxLength={150}
          />
          <span className="hint">Leave empty when the dropdown already has your material.</span>
        </label>

        <div className="row">
          <label>
            Device
            <select required value={form.device_id} onChange={(e) => onDeviceChange(e.target.value)}>
              <option value="">Select…</option>
              {devicesWithLasers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          {showLaserSelector ? (
            <label>
              Laser source
              <select required value={form.laser_type_id} onChange={(e) => set('laser_type_id', e.target.value)}>
                <option value="">Select…</option>
                {laserOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          ) : (
            <label>
              Laser source
              <input
                value={laserOptions[0]?.name ?? ''}
                readOnly
                placeholder="Select a device"
              />
              <span className="hint">Auto-selected from the device.</span>
            </label>
          )}
        </div>

        <label>
          Operation
          <select required value={form.operation_type_id} onChange={(e) => set('operation_type_id', e.target.value)}>
            <option value="">Select…</option>
            {refs.data?.ops.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>

        <div className="row">
          <label>Power (%)<input type="number" min={0} max={100} step="0.1" value={form.power} onChange={(e) => set('power', e.target.value)} /></label>
          <label>Speed (mm/s)<input type="number" min={0} step="1" value={form.speed} onChange={(e) => set('speed', e.target.value)} /></label>
        </div>
        <div className="row">
          <label>Passes<input type="number" min={1} max={50} value={form.passes} onChange={(e) => set('passes', e.target.value)} /></label>
          <label>Frequency (kHz)<input type="number" min={0} value={form.frequency} onChange={(e) => set('frequency', e.target.value)} /></label>
        </div>
        <label>Defocus (mm)<input type="number" step="0.1" value={form.focus_offset} onChange={(e) => set('focus_offset', e.target.value)} /></label>

        <label>
          Notes for moderators/users (optional)
          <textarea
            maxLength={5000}
            value={form.result_description}
            onChange={(e) => set('result_description', e.target.value)}
            placeholder="Any context that helps others reproduce this setting"
          />
        </label>

        <label>
          Title
          <input
            value={title}
            placeholder="Auto-generated from your selections"
            onChange={(e) => setTitleOverride(e.target.value)}
          />
          {titleOverride !== null && (
            <button
              type="button"
              onClick={() => setTitleOverride(null)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent, #4f8cff)', font: 'inherit', textAlign: 'left' }}
            >
              Reset to auto title
            </button>
          )}
        </label>

        <label>
          Result photo (optional)
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          {photo && <span className="hint">{photo.name}</span>}
        </label>

        {err && <p className="err">{err}</p>}
        <div className="toolbar">
          <Button type="submit" variant="primary" size="sm" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save setting'}
          </Button>
          <span className="hint">Enters the moderation queue. You can add more details and images on the next screen.</span>
        </div>
      </form>
    </PageBlock>
  );
}
