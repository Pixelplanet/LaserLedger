import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { UploadProgress } from '../components/UploadProgress';
import { uploadFileWithProgress, type UploadProgressState } from '../lib/upload-progress';

interface RefRow { id: number; name: string; ext_id?: string | null; xtool_material_id?: string | null }
interface CreateResp { uuid: string }
interface ParseResp {
  parsed: Record<string, unknown> & { layers?: Record<string, unknown>[] };
  resolved: { device: { id: number } | null; material: { id: number } | null };
  warnings: string[];
}

export default function SubmitPage() {
  const nav = useNavigate();
  const refs = useQuery({
    queryKey: ['submit-refs'],
    queryFn: async () => {
      const [devices, lasers, materials, ops] = await Promise.all([
        api<RefRow[]>('/devices'),
        api<RefRow[]>('/laser-types'),
        api<RefRow[]>('/materials'),
        api<RefRow[]>('/operation-types'),
      ]);
      return { devices, lasers, materials, ops };
    },
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    device_id: '',
    laser_type_id: '',
    material_id: '',
    operation_type_id: '',
    power: '',
    speed: '',
    passes: '1',
    frequency: '',
    lpi: '',
    pulse_width: '',
    focus_offset: '',
    scan_mode: '',
    quality_rating: '',
    result_description: '',
    tags: '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [xcsProgress, setXcsProgress] = useState<UploadProgressState | null>(null);
  const [sourceXcs, setSourceXcs] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState<'xcs' | 'xs' | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  async function onXcsFile(file: File) {
    setErr(null);
    setWarnings([]);
    setXcsProgress(null);
    setParsing(true);
    try {
      // Start parse first (main flow — mocked in tests)
      const p = await uploadFileWithProgress<ParseResp>('/api/settings/parse-xcs', 'file', file, setXcsProgress);
      const parsed = p.parsed as Record<string, unknown>;
      const firstLayer = Array.isArray(p.parsed.layers) ? p.parsed.layers[0] ?? {} : {};
      setForm((f) => ({
        ...f,
        title: f.title || (typeof parsed.title === 'string' ? parsed.title : f.title),
        device_id: p.resolved.device ? String(p.resolved.device.id) : f.device_id,
        material_id: p.resolved.material ? String(p.resolved.material.id) : f.material_id,
        power: firstLayer.power != null ? String(firstLayer.power) : parsed.power != null ? String(parsed.power) : f.power,
        speed: firstLayer.speed != null ? String(firstLayer.speed) : parsed.speed != null ? String(parsed.speed) : f.speed,
        passes: firstLayer.passes != null ? String(firstLayer.passes) : parsed.passes != null ? String(parsed.passes) : f.passes,
        frequency: firstLayer.frequency != null ? String(firstLayer.frequency) : parsed.frequency != null ? String(parsed.frequency) : f.frequency,
        lpi: firstLayer.lpi != null ? String(firstLayer.lpi) : parsed.lpi != null ? String(parsed.lpi) : f.lpi,
        pulse_width: firstLayer.pulse_width != null ? String(firstLayer.pulse_width) : parsed.pulse_width != null ? String(parsed.pulse_width) : f.pulse_width,
        focus_offset: parsed.focus_offset != null ? String(parsed.focus_offset) : f.focus_offset,
        scan_mode: typeof firstLayer.scan_mode === 'string' ? firstLayer.scan_mode : typeof parsed.scan_mode === 'string' ? parsed.scan_mode : f.scan_mode,
      }));
      setWarnings(p.warnings ?? []);

      // Best-effort raw file read for preservation (text for .xcs, base64 for .xs ZIP)
      const isXs = file.name.endsWith('.xs') || file.type === 'application/zip';
      try {
        const raw = isXs
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]!);
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsDataURL(file);
            })
          : await file.text();
        setSourceXcs(raw);
        setSourceFormat(isXs ? 'xs' : 'xcs');
      } catch {
        setSourceXcs(null);
        setSourceFormat(null);
      }
    } catch (e) {
      setSourceXcs(null);
      setSourceFormat(null);
      setErr(e instanceof Error ? e.message : 'XCS parse failed');
    } finally {
      setParsing(false);
    }
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<CreateResp>('/settings', { method: 'POST', body }),
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Submission failed'),
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function num(v: string): number | null {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.device_id || !form.laser_type_id || !form.material_id || !form.operation_type_id) {
      setErr('Device, laser, material, and operation are required.');
      return;
    }
    const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        device_id: Number(form.device_id),
        laser_type_id: Number(form.laser_type_id),
        material_id: Number(form.material_id),
        operation_type_id: Number(form.operation_type_id),
        power: num(form.power),
        speed: num(form.speed),
        passes: num(form.passes) ?? 1,
        frequency: num(form.frequency),
        lpi: num(form.lpi),
        pulse_width: num(form.pulse_width),
        focus_offset: num(form.focus_offset),
        scan_mode: form.scan_mode || null,
        quality_rating: num(form.quality_rating),
        result_description: form.result_description.trim() || null,
        tags,
      };
      if (sourceXcs) {
        body.source_xcs = sourceXcs;
        body.source_format = sourceFormat;
      }
      const created = await create.mutateAsync(body);
      // Upload result images if any (best-effort after creation)
      if (images.length > 0) {
        setUploadingImages(true);
        for (const file of images) {
          const fd = new FormData();
          fd.append('image', file);
          const res = await fetch(`/api/settings/${created.uuid}/images`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message ?? `Image upload failed: ${file.name}`);
          }
        }
      }
      nav(`/settings/${created.uuid}/edit`);
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(e.message);
      } else {
        setErr(e instanceof Error ? e.message : 'Submission failed');
      }
    }
  }

  return (
    <PageBlock title="Submit a setting" subtitle="Share a known-good recipe with the community.">
      <div className="form" style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px dashed var(--border)', borderRadius: 8 }}>
        <label>
          Import from xTool Studio (.xs) or Creative Space (.xcs)
          <input
            type="file"
            accept=".xs,.xcs,application/json,application/zip"
            disabled={parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onXcsFile(f);
            }}
          />
        </label>
        <UploadProgress state={xcsProgress} />
        {parsing && <p className="hint">Parsing…</p>}
        {warnings.length > 0 && (
          <ul className="hint">
            {warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
          </ul>
        )}
      </div>
      <form className="form wide" onSubmit={onSubmit}>
        <label>
          Title
          <input required minLength={3} maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label>
          Description
          <textarea maxLength={10000} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="row">
          <label>
            Device
            <select required value={form.device_id} onChange={(e) => set('device_id', e.target.value)}>
              <option value="">Select…</option>
              {refs.data?.devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>
            Laser type
            <select required value={form.laser_type_id} onChange={(e) => set('laser_type_id', e.target.value)}>
              <option value="">Select…</option>
              {refs.data?.lasers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        </div>

        <div className="row">
          <label>
            Material
            <select required value={form.material_id} onChange={(e) => set('material_id', e.target.value)}>
              <option value="">Select…</option>
              {refs.data?.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label>
            Operation
            <select required value={form.operation_type_id} onChange={(e) => set('operation_type_id', e.target.value)}>
              <option value="">Select…</option>
              {refs.data?.ops.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </div>

        <div className="row">
          <label>Power (%)<input type="number" min={0} max={100} step="0.1" value={form.power} onChange={(e) => set('power', e.target.value)} /></label>
          <label>Speed (mm/s)<input type="number" min={0} step="1" value={form.speed} onChange={(e) => set('speed', e.target.value)} /></label>
        </div>
        <div className="row">
          <label>Passes<input type="number" min={1} max={50} value={form.passes} onChange={(e) => set('passes', e.target.value)} /></label>
          <label>Frequency (kHz)<input type="number" min={0} value={form.frequency} onChange={(e) => set('frequency', e.target.value)} /></label>
        </div>
        <div className="row">
          <label>LPI<input type="number" min={0} value={form.lpi} onChange={(e) => set('lpi', e.target.value)} /></label>
          <label>Pulse width (ns)<input type="number" min={0} value={form.pulse_width} onChange={(e) => set('pulse_width', e.target.value)} /></label>
        </div>
        <div className="row">
          <label>Focus offset (mm)<input type="number" step="0.1" value={form.focus_offset} onChange={(e) => set('focus_offset', e.target.value)} /></label>
          <label>
            Scan mode
            <select value={form.scan_mode} onChange={(e) => set('scan_mode', e.target.value)}>
              <option value="">—</option>
              <option value="lineMode">Line</option>
              <option value="crossMode">Cross</option>
              <option value="zMode">Z</option>
            </select>
          </label>
        </div>

        <label>
          Quality rating (1–5)
          <input type="number" min={1} max={5} value={form.quality_rating} onChange={(e) => set('quality_rating', e.target.value)} />
        </label>

        <label>
          Result notes
          <textarea maxLength={5000} value={form.result_description} onChange={(e) => set('result_description', e.target.value)} placeholder="What did the result look like? Any observations?" />
        </label>

        <label>
          Tags (comma separated)
          <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="anodized, deep-engrave, monochrome" />
        </label>

        <label>
          Result images (test grid photos, up to 5)
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={create.isPending || uploadingImages}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setImages((prev) => [...prev, ...files].slice(0, 5));
              e.target.value = '';
            }}
          />
        </label>
        {images.length > 0 && (
          <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>{images.length} image{images.length > 1 ? 's' : ''} selected: {images.map((f) => f.name).join(', ')}</span>
            <button type="button" className="btn sm" onClick={() => setImages([])}>Clear</button>
          </div>
        )}

        {err && <p className="err">{err}</p>}
        <div className="toolbar">
          <Button type="submit" variant="primary" size="sm" disabled={create.isPending || uploadingImages}>
            {create.isPending || uploadingImages ? 'Submitting…' : 'Submit for review'}
          </Button>
          <span className="hint">Your submission enters the moderation queue. You'll be taken to the edit screen where you can add more details.</span>
        </div>
      </form>
    </PageBlock>
  );
}
