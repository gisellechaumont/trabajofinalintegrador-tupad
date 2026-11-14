import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, Field, PageHeader, StatusBadge } from '../../shared/components/ui';
import { ApiError, errorMessage } from '../../shared/services/http';
import { roleLabels, type ApiData, type User } from '../../shared/types/api';

export function ProfilePage() {
  const { user, updateUser, api } = useSession();
  const [name, setName] = useState(user?.name ?? ''); const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  if (!user) return null;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice(''); setFields({});
    try {
      const result = await api.request<ApiData<User>>('/auth/profile', { method: 'PATCH', body: { name, email } });
      updateUser(result.data); setName(result.data.name); setEmail(result.data.email); setNotice('Tu perfil se actualizó correctamente.');
    } catch (failure) { setError(errorMessage(failure)); if (failure instanceof ApiError) setFields(failure.fields); }
    finally { setBusy(false); }
  }
  return <><PageHeader eyebrow="TU CUENTA" title="Mi perfil" description="Revisá tu información y mantené actualizados tus datos de contacto." /><div className="profile-grid"><section className="card profile-summary"><span className="avatar large" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><h2>{user.name}</h2><p className="muted">{roleLabels[user.role]}</p><StatusBadge active={user.active} /><p className="small muted">El rol y el estado de acceso los administra el gimnasio.</p><Link className="text-link" to="/cambiar-contrasena">Cambiar contraseña →</Link></section><form className="card form-card" onSubmit={submit}><h2>Datos personales</h2>{error && <Alert>{error}</Alert>}{notice && <Alert tone="success">{notice}</Alert>}<Field label="Nombre y apellido" autoComplete="name" required maxLength={120} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} error={fields.name} /><Field label="Correo electrónico" type="email" autoComplete="email" required maxLength={255} value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} error={fields.email} hint="Usá este correo para tu próximo inicio de sesión." /><div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button></div></form></div></>;
}
