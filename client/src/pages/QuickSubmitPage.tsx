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
interface MaterialRow { id: number; name: string; thickness_mm?: number | null }
interface OpRow { id: number; name: string }
interface CreateResp { uuid: string }

export default function QuickSubmitPage() {
  const nav = useNavigate();
  const refs = useQuery({
    queryKey: ['quick-submit-refs'],
    queryFn: async () => {
      const [devices, lasers, materials, ops] = await Promise.all([
        api<DeviceRow[]>('/devices'),
        api<LaserRow[]>('/laser-types'),
        api<MaterialRow[]>('/materials'),
        api<OpRow[]>('/operation-types'),
      ]);
      return { devices, lasers, materials, ops };
    },
  });

  const [form, setForm] = useState({
    device_id: '',
    laser_type_id: '',
    material_id: '',
    operation_type_id: '',
    power: '',
    speed: '',
    passes: '1',
  });
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Laser types available for the chosen device (fall back to all laser types).
  const laserOptions = useMemo<LaserRow[]>(() => {
    if (!refs.data) return [];
    const dev = refs.data.devices.find((d) => String(d.id) === form.device_id);
    if (dev?.laser_types && dev.laser_types.length > 0) return dev.laser_types;
    return refs.data.lasers;
  }, [refs.data, form.device_id]);

  const autoTitle = useMemo(() => {
    if (!refs.data) return '';
    const device = refs.data.devices.find((d) => String(d.id) === form.device_id)?.name;
    const laser = laserOptions.find((l) => String(l.id) === form.laser_type_id)?.name;
    const material = refs.data.materials.find((m) => String(m.id) === form.material_id);
    const operation = refs.data.ops.find((o) => String(o.id) === form.operation_type_id)?.name;
    return buildRecipeTitle({
      operation,
      material: material?.name,
      thickness_mm: material?.thickness_mm ?? null,
      device,
      laser,
    });
  }, [refs.data, form.device_id, form.laser_type_id, form.material_id, form.operation_type_id, laserOptions]);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.device_id || !form.laser_type_id || !form.material_id || !form.operation_type_id) {
      setErr('Material, device, laser, and operation are required.');
      return;
    }
    const finalTitle = title.trim();
    if (finalTitle.length < 3) {
      setErr('Could not build a title — please enter one.');
      return;
    }
    try {
      const created = await create.mutateAsync({
        title: finalTitle,
        device_id: Number(form.device_id),
        laser_type_id: Number(form.laser_type_id),
        material_id: Number(form.material_id),
        operation_type_id: Number(form.operation_type_id),
        power: num(form.power),
        speed: num(form.speed),
        passes: num(form.passes) ?? 1,
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
      title="Quick recipe"
      subtitle="Capture one known-good setting in seconds. Need every field? Use the full submit form."
    >
      <form className="form quick-recipe" onSubmit={onSubmit}>
        <label>
          Material
          <select required value={form.material_id} onChange={(e) => set('material_id', e.target.value)}>
            <option value="">Select…</option>
            {refs.data?.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.thickness_mm != null ? ` (${m.thickness_mm}mm)` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          <label>
            Device
            <select required value={form.device_id} onChange={(e) => { set('device_id', e.target.value); set('laser_type_id', ''); }}>
              <option value="">Select…</option>
              {refs.data?.devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>
            Laser
            <select required value={form.laser_type_id} onChange={(e) => set('laser_type_id', e.target.value)}>
              <option value="">Select…</option>
              {laserOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
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
        <label>Passes<input type="number" min={1} max={50} value={form.passes} onChange={(e) => set('passes', e.target.value)} /></label>

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
            {create.isPending ? 'Saving…' : 'Save recipe'}
          </Button>
          <span className="hint">Enters the moderation queue. You can add more details and images on the next screen.</span>
        </div>
      </form>
    </PageBlock>
  );
}
