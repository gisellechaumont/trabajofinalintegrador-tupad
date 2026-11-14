import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ErrorState, Field, LoadingState, PageHeader, TextArea } from '../../shared/components/ui';
import { ApiError, errorMessage, isAbort } from '../../shared/services/http';
import type { Activity, ApiData } from '../../shared/types/api';

export function ActivityFormPage({ editing = false }: { editing?: boolean }) {
  const { api } = useSession(); const { id } = useParams(); const navigate = useNavigate();
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [loading, setLoading] = useState(editing); const [loadError, setLoadError] = useState(''); const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!editing) { setName(''); setDescription(''); setLoading(false); setLoadError(''); return; }
    const controller = new AbortController(); setLoading(true); setLoadError('');
    api.request<ApiData<Activity>>(`/activities/${id}`, { signal: controller.signal }).then(({ data }) => { if (!controller.signal.aborted) { setName(data.name); setDescription(data.description ?? ''); } })
      .catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setLoadError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, id, editing, revision]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setFields({});
    try {
      await api.request<ApiData<Activity>>(editing ? `/activities/${id}` : '/activities', { method: editing ? 'PATCH' : 'POST', body: { name, description: description.trim() || null } });
      navigate('/admin/actividades', { replace: true, state: { notice: editing ? 'Actividad actualizada correctamente.' : 'Actividad creada correctamente.' } });
    } catch (failure) { setError(errorMessage(failure)); if (failure instanceof ApiError) setFields(failure.fields); }
    finally { setBusy(false); }
  }
  return <><Link className="back-link" to="/admin/actividades">← Volver a actividades</Link><PageHeader eyebrow="ADMINISTRACIÓN / CATÁLOGO" title={editing ? 'Editar actividad' : 'Crear actividad'} description="Una actividad define la disciplina. Los horarios y profesores se asignan en el módulo de clases." />
    {loading ? <LoadingState /> : loadError ? <ErrorState message={loadError} retry={() => setRevision((value) => value + 1)} /> : <form className="card form-card narrow" onSubmit={submit}>{error && <Alert>{error}</Alert>}<Field label="Nombre de la actividad" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} disabled={busy} error={fields.name} placeholder="Por ejemplo, Yoga" /><TextArea label="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={5} disabled={busy} error={fields.description} /><p className="small muted">No se permiten nombres duplicados, incluso si cambian las mayúsculas.</p><div className="form-actions"><Link className="button secondary" to="/admin/actividades">Cancelar</Link><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear actividad'}</Button></div></form>}
  </>;
}
