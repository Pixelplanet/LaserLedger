import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';

interface RefRow { id: number; name: string; ext_id?: string | null; xtool_material_id?: string | null }
interface CreateResp { uuid: string }
interface ParseResp {
  parsed: Record<string, unknown>;
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

  async function onXcsFile(file: File) {
    setErr(null);
    setWarnings([]);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/parse-xcs', { method: 'POST', credentials: 'include', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'XCS parse failed');
      const p = json.data as ParseResp;
      const parsed = p.parsed as Record<string, unknown>;
      setForm((f) => ({
        ...f,
        title: f.title || (typeof parsed.title === 'string' ? parsed.title : f.title),
        device_id: p.resolved.device ? String(p.resolved.device.id) : f.device_id,
        material_id: p.resolved.material ? String(p.resolved.material.id) : f.material_id,
        power: parsed.power != null ? String(parsed.power) : f.power,
        speed: parsed.speed != null ? String(parsed.speed) : f.speed,
        passes: parsed.passes != null ? String(parsed.passes) : f.passes,
        frequency: parsed.frequency != null ? String(parsed.frequency) : f.frequency,
        lpi: parsed.lpi != null ? String(parsed.lpi) : f.lpi,
        pulse_width: parsed.pulse_width != null ? String(parsed.pulse_width) : f.pulse_width,
        focus_offset: parsed.focus_offset != null ? String(parsed.focus_offset) : f.focus_offset,
        scan_mode: typeof parsed.scan_mode === 'string' ? parsed.scan_mode : f.scan_mode,
      }));
      setWarnings(p.warnings ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'XCS parse failed');
    } finally {
      setParsing(false);
    }
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<CreateResp>('/settings', { method: 'POST', body }),
    onSuccess: (res) => nav(`/settings/${res.uuid}`),
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.device_id || !form.laser_type_id || !form.material_id || !form.operation_type_id) {
      setErr('Device, laser, material, and operation are required.');
      return;
    }
    const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
    create.mutate({
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
    });
  }

  return (
    <PageBlock title="Submit a setting" subtitle="Share a known-good recipe with the community.">
      <div className="form" style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px dashed var(--border)', borderRadius: 8 }}>
        <label>
          Import from xTool Creative Space (.xcs)
          <input
            type="file"
            accept=".xcs,application/json,application/zip"
            disabled={parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onXcsFile(f);
            }}
          />
        </label>
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

        {err && <p className="err">{err}</p>}
        <div className="toolbar">
          <Button type="submit" variant="primary" size="sm" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit for review'}
          </Button>
          <span className="hint">Your submission enters the moderation queue. You can edit and add images while it's pending.</span>
        </div>
      </form>
    </PageBlock>
  );
}
