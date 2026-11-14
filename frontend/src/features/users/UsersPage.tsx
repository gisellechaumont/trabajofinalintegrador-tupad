import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, Field, LoadingState, PageHeader, Pagination, Select, StatusBadge } from '../../shared/components/ui';
import { errorMessage } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import type { ApiData, ApiPage, User } from '../../shared/types/api';
import { userLabels, userPaths, type ManagedRole } from './userPaths';

export function UsersPage({ role }: { role: ManagedRole }) {
  const { api } = useSession(); const labels = userLabels(role); const base = userPaths(role);
  const [search, setSearch] = useState(''); const [active, setActive] = useState(''); const [page, setPage] = useState(1);
  const [pending, setPending] = useState<User | null>(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [actionError, setActionError] = useState('');
  const query = new URLSearchParams({ role, page: String(page), pageSize: '10', ...(search ? { search } : {}), ...(active ? { active } : {}) });
  const result = useResource<ApiPage<User>>(`/users?${query}`, true);
  useEffect(() => {
    if (result.data && page > Math.max(1, Math.ceil(result.data.meta.total / 10))) setPage(Math.max(1, Math.ceil(result.data.meta.total / 10)));
  }, [result.data, page]);
  async function confirmState() {
    if (!pending || busy) return; setBusy(true); setActionError(''); setNotice('');
    try {
      const changed = await api.request<ApiData<User>>(`/users/${pending.id}`, { method: 'PATCH', body: { active: !pending.active } });
      result.setData((previous) => previous ? { ...previous, data: previous.data.map((user) => user.id === changed.data.id ? changed.data : user) } : previous);
      setPending(null); setNotice(`${changed.data.name}: cuenta ${changed.data.active ? 'activada' : 'desactivada'} correctamente.`); result.refresh();
    } catch (failure) { setActionError(errorMessage(failure)); setPending(null); }
    finally { setBusy(false); }
  }
  return <><PageHeader eyebrow="ADMINISTRACIÓN / PERSONAS" title={labels.plural} description={`Administrá los datos y el acceso de cada ${labels.singular}. El historial siempre se conserva.`} action={<Link className="button primary" to={`${base}/nuevo`}>+ {labels.create}</Link>} />
    {notice && <Alert tone="success">{notice}</Alert>}{actionError && <Alert>{actionError}</Alert>}
    <section className="card list-card"><div className="list-toolbar"><Field label={`Buscar ${labels.singular}`} type="search" placeholder="Nombre o correo electrónico" value={search} maxLength={120} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><Select label="Estado" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option></Select></div>
      {result.loading && <LoadingState label={result.data ? 'Actualizando listado…' : `Cargando ${labels.plural.toLowerCase()}…`} />}
      {result.error && <ErrorState message={result.error} retry={result.refresh} />}
      {result.data && !result.error && (result.data.data.length ? <div className="table-scroll" aria-busy={result.loading}><table><caption className="sr-only">Listado de {labels.plural.toLowerCase()}</caption><thead><tr><th>Nombre y apellido</th><th>Correo electrónico</th><th>Estado</th><th className="actions-heading">Acciones</th></tr></thead><tbody>{result.data.data.map((user) => <tr key={user.id}><td><Link className="person-link" to={`${base}/${user.id}`}><span className="avatar mini" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>{user.name}</Link></td><td>{user.email}</td><td><StatusBadge active={user.active} /></td><td><div className="row-actions"><Link className="text-link" to={`${base}/${user.id}/editar`}>Editar</Link><Button aria-label={`${user.active ? 'Desactivar' : 'Activar'} a ${user.name}`} variant={user.active ? 'ghost' : 'secondary'} disabled={busy || result.loading} onClick={() => { setPending(user); setActionError(''); }}>{user.active ? 'Desactivar' : 'Activar'}</Button></div></td></tr>)}</tbody></table></div> : !result.loading && <EmptyState title={search || active ? 'No hay coincidencias' : `Todavía no hay ${labels.plural.toLowerCase()}`}>{search || active ? 'Probá otro nombre o cambiá los filtros.' : `Registrá el primer ${labels.singular} para comenzar.`}</EmptyState>)}
      {result.data && <Pagination page={page} pageSize={10} total={result.data.meta.total} onChange={setPage} />}
    </section>
    <ConfirmDialog open={Boolean(pending)} busy={busy} title={`${pending?.active ? 'Desactivar' : 'Activar'} cuenta`} confirmLabel={pending?.active ? 'Desactivar cuenta' : 'Activar cuenta'} onClose={() => setPending(null)} onConfirm={confirmState}>{pending && <p>{pending.active ? `${pending.name} dejará de poder ingresar al sistema. Su historial se conserva y no se cancelan automáticamente clases ni reservas.` : `${pending.name} recuperará el acceso con su misma cuenta e historial.`}</p>}</ConfirmDialog>
  </>;
}
