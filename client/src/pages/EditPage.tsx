import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { ErrorBlock, LoadingBlock } from '../components/States';
import { ImageUploader } from '../components/ImageUploader';
import { useAuthStore } from '../lib/auth-store';

interface Setting {
  uuid: string;
  user_id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
  title: string;
  description: string | null;
  result_description: string | null;
  power: number | null;
  speed: number | null;
  passes: number | null;
  frequency: number | null;
  lpi: number | null;
  pulse_width: number | null;
  focus_offset: number | null;
  scan_mode: string | null;
  quality_rating: number | null;
  tags: { id: number; name: string; slug: string }[];
}

export default function EditPage() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['setting', uuid],
    queryFn: () => api<Setting>(`/settings/${uuid}`),
    enabled: !!uuid,
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    result_description: '',
    power: '',
    speed: '',
    passes: '',
    frequency: '',
    lpi: '',
    pulse_width: '',
    focus_offset: '',
    scan_mode: '',
    quality_rating: '',
    tags: '',
  });

  useEffect(() => {
    if (!q.data) return;
    const s = q.data;
    setForm({
      title: s.title,
      description: s.description ?? '',
      result_description: s.result_description ?? '',
      power: s.power?.toString() ?? '',
      speed: s.speed?.toString() ?? '',
      passes: s.passes?.toString() ?? '',
      frequency: s.frequency?.toString() ?? '',
      lpi: s.lpi?.toString() ?? '',
      pulse_width: s.pulse_width?.toString() ?? '',
      focus_offset: s.focus_offset?.toString() ?? '',
      scan_mode: s.scan_mode ?? '',
      quality_rating: s.quality_rating?.toString() ?? '',
      tags: s.tags.map((t) => t.name).join(', '),
    });
  }, [q.data]);

  const isOwner = !!user && !!q.data && user.id === q.data.user_id;
  const isStaff = user?.role === 'moderator' || user?.role === 'admin';
  const canEdit = (isOwner && q.data?.status === 'pending') || isStaff;

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/settings/${uuid}`, { method: 'PATCH', body }),
    onSuccess: () => nav(`/settings/${uuid}`),
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Update failed'),
  });

  function num(v: string): number | null {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    update.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      result_description: form.result_description.trim() || null,
      power: num(form.power),
      speed: num(form.speed),
      passes: num(form.passes) ?? 1,
      frequency: num(form.frequency),
      lpi: num(form.lpi),
      pulse_width: num(form.pulse_width),
      focus_offset: num(form.focus_offset),
      scan_mode: form.scan_mode || null,
      quality_rating: num(form.quality_rating),
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
    });
  }

  if (q.isLoading) return <PageBlock title="Edit setting"><LoadingBlock /></PageBlock>;
  if (q.isError || !q.data) return <PageBlock title="Edit setting"><ErrorBlock>Setting not found.</ErrorBlock></PageBlock>;
  if (!canEdit) {
    return (
      <PageBlock title="Edit setting" subtitle={`Status: ${q.data.status}`}>
        <ErrorBlock>You can only edit your own pending submissions.</ErrorBlock>
      </PageBlock>
    );
  }

  return (
    <PageBlock title="Edit setting" subtitle={`#${q.data.uuid.slice(0, 8)} · ${q.data.status}`}>
      <form className="form wide" onSubmit={onSubmit}>
        <label>Title<input required minLength={3} maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label>Description<textarea maxLength={10000} value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
        <div className="row">
          <label>Power (%)<input type="number" min={0} max={100} step="0.1" value={form.power} onChange={(e) => set('power', e.target.value)} /></label>
          <label>Speed (mm/s)<input type="number" min={0} value={form.speed} onChange={(e) => set('speed', e.target.value)} /></label>
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
        <label>Quality rating (1–5)<input type="number" min={1} max={5} value={form.quality_rating} onChange={(e) => set('quality_rating', e.target.value)} /></label>
        <label>Result notes<textarea maxLength={5000} value={form.result_description} onChange={(e) => set('result_description', e.target.value)} /></label>
        <label>Tags (comma separated)<input value={form.tags} onChange={(e) => set('tags', e.target.value)} /></label>
        {err && <ErrorBlock>{err}</ErrorBlock>}
        <div className="toolbar">
          <Button type="submit" variant="primary" size="sm" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" size="sm" onClick={() => nav(`/settings/${uuid}`)}>Cancel</Button>
        </div>
      </form>
      <ImageUploader uuid={q.data.uuid} canEdit={canEdit} />
    </PageBlock>
  );
}
