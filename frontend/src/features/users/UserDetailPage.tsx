import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, ErrorState, LoadingState, PageHeader, StatusBadge } from '../../shared/components/ui';
import { errorMessage } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import { roleLabels, type ApiData, type User } from '../../shared/types/api';
import { userLabels, userPaths, type ManagedRole } from './userPaths';

export function UserDetailPage({ role }: { role: ManagedRole }) {
  const { api } = useSession(); const { id } = useParams(); const base = userPaths(role); const labels = userLabels(role); const location = useLocation();
  const result = useResource<ApiData<User>>(`/users/${id}`);
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(typeof location.state?.notice === 'string' ? location.state.notice : '');
  const user = result.data?.data;
  async function changeState() {
    if (!user || busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.request<ApiData<User>>(`/users/${user.id}`, { method: 'PATCH', body: { active: !user.active } });
      result.setData(response); setConfirm(false); setNotice(`Cuenta ${response.data.active ? 'activada' : 'desactivada'} correctamente.`);
    } catch (failure) { setError(errorMessage(failure)); setConfirm(false); }
    finally { setBusy(false); }
  }
  return <><Link className="back-link" to={base}>← Volver a {labels.plural.toLowerCase()}</Link><PageHeader eyebrow="ADMINISTRACIÓN / PERSONAS" title={`Ficha de ${labels.singular}`} description="Información de la cuenta y su estado de acceso." />
    {result.loading && <LoadingState />}{result.error && <ErrorState message={result.error} retry={result.refresh} />}
    {user && user.role !== role && <Alert>Esta cuenta no corresponde a la sección {labels.plural}.</Alert>}
    {user?.role === role && <>{notice && <Alert tone="success">{notice}</Alert>}{error && <Alert>{error}</Alert>}<section className="card detail-card"><div className="detail-person"><span className="avatar large" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><div><h2>{user.name}</h2><p className="muted">{roleLabels[user.role]} · Cuenta #{user.id}</p></div><StatusBadge active={user.active} /></div><dl className="details"><div><dt>Correo electrónico</dt><dd>{user.email}</dd></div><div><dt>Rol</dt><dd>{roleLabels[user.role]}</dd></div><div><dt>Estado</dt><dd>{user.active ? 'Puede ingresar al sistema' : 'Acceso deshabilitado, historial conservado'}</dd></div></dl><div className="form-actions"><Link className="button secondary" to={`${base}/${user.id}/editar`}>Editar datos</Link><Button variant={user.active ? 'danger' : 'primary'} disabled={busy} onClick={() => setConfirm(true)}>{user.active ? 'Desactivar cuenta' : 'Activar cuenta'}</Button></div></section>
      {role === 'MEMBER' && <section className="card integration-note"><h2>Paquetes e historial</h2><p className="muted">Estas vistas pertenecen al módulo operativo de Emilia. Los enlaces están preparados para integrarlo, sin duplicar su lógica en usuarios.</p><div className="inline-links"><Link to={`/admin/paquetes?memberId=${user.id}`}>Ver paquetes →</Link><Link to={`/admin/historial?memberId=${user.id}`}>Ver historial →</Link></div></section>}
      <ConfirmDialog open={confirm} busy={busy} title={user.active ? 'Desactivar cuenta' : 'Activar cuenta'} confirmLabel={user.active ? 'Desactivar cuenta' : 'Activar cuenta'} onClose={() => setConfirm(false)} onConfirm={changeState}><p>{user.active ? 'La persona dejará de poder ingresar. Su historial se conserva; las clases y reservas no se cancelan automáticamente.' : 'Se restablecerá el acceso de esta misma cuenta, conservando su información.'}</p></ConfirmDialog>
    </>}
  </>;
}
