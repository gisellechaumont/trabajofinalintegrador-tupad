import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ErrorState, Field, LoadingState, PageHeader } from '../../shared/components/ui';
import { ApiError, errorMessage, isAbort } from '../../shared/services/http';
import type { ApiData, User } from '../../shared/types/api';
import { userLabels, userPaths, type ManagedRole } from './userPaths';

export function UserFormPage({ role, editing = false }: { role: ManagedRole; editing?: boolean }) {
  const { api } = useSession(); const navigate = useNavigate(); const { id } = useParams(); const base = userPaths(role); const labels = userLabels(role);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(editing); const [loadError, setLoadError] = useState(''); const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!editing) { setName(''); setEmail(''); setPassword(''); setLoading(false); setLoadError(''); return; }
    const controller = new AbortController(); setLoading(true); setLoadError('');
    api.request<ApiData<User>>(`/users/${id}`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (data.role !== role) { setLoadError(`La cuenta no corresponde a la sección ${labels.plural}.`); return; }
      setName(data.name); setEmail(data.email);
    }).catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setLoadError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, id, editing, role, labels.plural, revision]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setFields({});
    try {
      const result = await api.request<ApiData<User>>(editing ? `/users/${id}` : '/users', { method: editing ? 'PATCH' : 'POST', body: editing ? { name, email } : { name, email, password, role } });
      navigate(`${base}/${result.data.id}`, { replace: true, state: { notice: editing ? 'Datos actualizados correctamente.' : `${labels.singular === 'socio' ? 'Socio registrado' : 'Profesor registrado'} correctamente.` } });
    } catch (failure) { setError(errorMessage(failure)); if (failure instanceof ApiError) setFields(failure.fields); }
    finally { setBusy(false); }
  }
  return <><Link className="back-link" to={base}>← Volver a {labels.plural.toLowerCase()}</Link><PageHeader eyebrow="ADMINISTRACIÓN / PERSONAS" title={editing ? `Editar ${labels.singular}` : labels.create} description={editing ? 'El rol se conserva. El estado de acceso se administra desde la ficha o el listado.' : 'La cuenta se creará activa y con el rol de esta sección.'} />
    {loading ? <LoadingState /> : loadError ? <ErrorState message={loadError} retry={() => setRevision((value) => value + 1)} /> : <form className="card form-card narrow" onSubmit={submit}>{error && <Alert>{error}</Alert>}<Field label="Nombre y apellido" autoComplete="name" value={name} required maxLength={120} disabled={busy} onChange={(e) => setName(e.target.value)} error={fields.name} /><Field label="Correo electrónico" type="email" autoComplete="email" value={email} required maxLength={255} disabled={busy} onChange={(e) => setEmail(e.target.value)} error={fields.email} />{!editing && <Field label="Contraseña inicial" type="password" autoComplete="new-password" value={password} required minLength={12} maxLength={128} disabled={busy} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="Entre 12 y 128 caracteres. Compartila únicamente con la persona titular de la cuenta." />}<div className="form-actions"><Link className="button secondary" to={base}>Cancelar</Link><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : labels.create}</Button></div></form>}
  </>;
}
