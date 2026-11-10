import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, Field, PageHeader } from '../../shared/components/ui';
import { ApiError, errorMessage } from '../../shared/services/http';

export function PasswordPage() {
  const { api, logout } = useSession(); const navigate = useNavigate();
  const [currentPassword, setCurrent] = useState(''); const [newPassword, setNew] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError(''); setFields({});
    if (newPassword !== confirm) { setFields({ confirm: 'Las contraseñas nuevas no coinciden.' }); return; }
    setBusy(true);
    try {
      await api.request<void>('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } });
      logout('Cambiaste tu contraseña. Iniciá sesión con la nueva clave.'); navigate('/login', { replace: true });
    } catch (failure) { setError(errorMessage(failure)); if (failure instanceof ApiError) setFields(failure.fields); }
    finally { setBusy(false); }
  }
  return <><PageHeader eyebrow="SEGURIDAD DE TU CUENTA" title="Cambiar contraseña" description="Elegí una clave de 12 a 128 caracteres que no uses en otros servicios." /><form className="card form-card narrow" onSubmit={submit}>{error && <Alert>{error}</Alert>}<Field label="Contraseña actual" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} disabled={busy} onChange={(e) => setCurrent(e.target.value)} error={fields.currentPassword} /><Field label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} disabled={busy} onChange={(e) => setNew(e.target.value)} error={fields.newPassword} /><Field label="Repetir nueva contraseña" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} error={fields.confirm} /><p className="small muted">Al guardar, se cierra la sesión de esta pestaña. Esta versión no revoca otras sesiones emitidas previamente; vencen según su duración.</p><div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Button></div></form></>;
}
