import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, Field, LoadingState, PageHeader, Pagination, Select, StatusBadge } from '../../shared/components/ui';
import { errorMessage } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import type { ApiPage } from '../../shared/types/api';
import { updatePackageType } from './packages.api';
import type { PackageType } from './packages.types';

const PAGE_SIZE = 10;

export function PackageTypesPage() {
  const { api } = useSession();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PackageType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => typeof location.state?.notice === 'string' ? location.state.notice as string : '');
  const result = useResource<ApiPage<PackageType>>(`/package-types?page=${page}&pageSize=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ''}${active ? `&active=${active}` : ''}`, true);

  useEffect(() => {
    if (!result.data) return;
    const lastPage = Math.max(1, Math.ceil(result.data.meta.total / PAGE_SIZE));
    if (page > lastPage) setPage(lastPage);
  }, [page, result.data]);

  async function toggleActive() {
    if (!pending || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await updatePackageType(api, pending.id, { active: !pending.active });
      setPending(null);
      setNotice(`Tipo de paquete ${data.active ? 'activado' : 'desactivado'} correctamente.`);
      result.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeader eyebrow="ADMINISTRACIÓN / PAQUETES" title="Tipos de paquete" description="Administrá las opciones que pueden asignarse a los socios." action={<Link className="button primary" to="/admin/tipos-paquete/nuevo">+ Crear tipo de paquete</Link>} />
    {notice && <Alert tone="success">{notice}</Alert>}
    {error && <Alert>{error}</Alert>}
    <section className="card list-card">
      <div className="list-toolbar">
        <Field label="Buscar tipo de paquete" type="search" value={search} maxLength={120} placeholder="Nombre" onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Select label="Estado" value={active} onChange={(event) => { setActive(event.target.value); setPage(1); }}>
          <option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option>
        </Select>
      </div>
      {result.loading && <LoadingState label={result.data ? 'Actualizando tipos de paquete…' : 'Cargando tipos de paquete…'} />}
      {result.error && <ErrorState message={result.error} retry={result.refresh} />}
      {result.data && !result.error && (result.data.data.length ? <div className="table-scroll" aria-busy={result.loading}>
        <table><caption className="sr-only">Tipos de paquete</caption><thead><tr><th>Nombre</th><th>Créditos incluidos</th><th>Duración</th><th>Estado</th><th className="actions-heading">Acciones</th></tr></thead>
          <tbody>{result.data.data.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong></td><td>{item.classCredits}</td><td>{item.durationDays} {item.durationDays === 1 ? 'día' : 'días'}</td><td><StatusBadge active={item.active} /></td>
            <td><div className="row-actions"><Link className="text-link" to={`/admin/tipos-paquete/${item.id}/editar`} aria-label={`Editar tipo de paquete ${item.name}`}>Editar</Link>
              <Button variant={item.active ? 'ghost' : 'secondary'} disabled={busy || result.loading} aria-label={`${item.active ? 'Desactivar' : 'Activar'} tipo de paquete ${item.name}`} onClick={() => { setError(''); setPending(item); }}>{item.active ? 'Desactivar' : 'Activar'}</Button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : !result.loading && <EmptyState title={search || active ? 'No hay coincidencias' : 'Todavía no hay tipos de paquete'}>{search || active ? 'Probá otro nombre o cambiá el filtro de estado.' : 'Creá un tipo de paquete para poder asignarlo a un socio.'}</EmptyState>)}
      {result.data && <Pagination page={page} pageSize={PAGE_SIZE} total={result.data.meta.total} onChange={setPage} />}
    </section>
    <ConfirmDialog open={Boolean(pending)} busy={busy} title={`${pending?.active ? 'Desactivar' : 'Activar'} tipo de paquete`} confirmLabel={pending?.active ? 'Desactivar tipo' : 'Activar tipo'} onClose={() => setPending(null)} onConfirm={toggleActive}>
      {pending && <p>{pending.active ? `${pending.name} dejará de estar disponible para nuevas asignaciones. Las asignaciones existentes se conservan.` : `${pending.name} volverá a estar disponible para nuevas asignaciones.`}</p>}
    </ConfirmDialog>
  </>;
}
