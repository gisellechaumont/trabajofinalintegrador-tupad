import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, Field, LoadingState, PageHeader, Pagination, Select, StatusBadge } from '../../shared/components/ui';
import { errorMessage } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import type { Activity, ApiPage, ApiData } from '../../shared/types/api';

export function ActivitiesPage() {
  const location = useLocation();
  const { api } = useSession(); const [search, setSearch] = useState(''); const [active, setActive] = useState(''); const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Activity | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(() => typeof location.state?.notice === 'string' ? location.state.notice as string : '');
  const query = new URLSearchParams({ page: String(page), pageSize: '10', ...(search ? { search } : {}), ...(active ? { active } : {}) });
  const result = useResource<ApiPage<Activity>>(`/activities?${query}`, true);
  useEffect(() => { if (result.data && page > Math.max(1, Math.ceil(result.data.meta.total / 10))) setPage(Math.max(1, Math.ceil(result.data.meta.total / 10))); }, [result.data, page]);
  async function confirmState() {
    if (!pending || busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.request<ApiData<Activity>>(`/activities/${pending.id}`, { method: 'PATCH', body: { active: !pending.active } });
      result.setData((previous) => previous ? { ...previous, data: previous.data.map((row) => row.id === response.data.id ? response.data : row) } : previous);
      setPending(null); setNotice(`Actividad ${response.data.active ? 'activada' : 'desactivada'} correctamente.`); result.refresh();
    } catch (failure) { setError(errorMessage(failure)); setPending(null); }
    finally { setBusy(false); }
  }
  return <><PageHeader eyebrow="ADMINISTRACIÓN / CATÁLOGO" title="Actividades" description="Organizá las disciplinas que se utilizarán al programar clases." action={<Link className="button primary" to="/admin/actividades/nueva">+ Crear actividad</Link>} />{notice && <Alert tone="success">{notice}</Alert>}{error && <Alert>{error}</Alert>}
    <section className="card list-card"><div className="list-toolbar"><Field label="Buscar actividad" type="search" value={search} maxLength={120} placeholder="Nombre de la actividad" onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><Select label="Estado" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="true">Activas</option><option value="false">Inactivas</option></Select></div>
      {result.loading && <LoadingState label={result.data ? 'Actualizando listado…' : 'Cargando actividades…'} />}{result.error && <ErrorState message={result.error} retry={result.refresh} />}
      {result.data && !result.error && (result.data.data.length ? <div className="table-scroll" aria-busy={result.loading}><table><caption className="sr-only">Catálogo de actividades</caption><thead><tr><th>Actividad</th><th>Descripción</th><th>Estado</th><th className="actions-heading">Acciones</th></tr></thead><tbody>{result.data.data.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td className="description-cell">{row.description || 'Sin descripción'}</td><td><StatusBadge active={row.active} /></td><td><div className="row-actions"><Link className="text-link" to={`/admin/actividades/${row.id}/editar`}>Editar<span className="sr-only"> {row.name}</span></Link><Button variant={row.active ? 'ghost' : 'secondary'} disabled={busy || result.loading} onClick={() => setPending(row)}>{row.active ? 'Desactivar' : 'Activar'}<span className="sr-only"> {row.name}</span></Button></div></td></tr>)}</tbody></table></div> : !result.loading && <EmptyState title={search || active ? 'No hay coincidencias' : 'Todavía no hay actividades'}>{search || active ? 'Probá otro nombre o cambiá los filtros.' : 'Creá la primera actividad para comenzar.'}</EmptyState>)}
      {result.data && <Pagination page={page} pageSize={10} total={result.data.meta.total} onChange={setPage} />}
    </section><ConfirmDialog open={Boolean(pending)} busy={busy} title={`${pending?.active ? 'Desactivar' : 'Activar'} actividad`} confirmLabel={pending?.active ? 'Desactivar actividad' : 'Activar actividad'} onClose={() => setPending(null)} onConfirm={confirmState}>{pending && <p>{pending.active ? `${pending.name} dejará de estar disponible para nuevas clases. Las clases existentes se conservan y requieren gestión explícita.` : `${pending.name} volverá a estar disponible para programar clases.`}</p>}</ConfirmDialog>
  </>;
}
