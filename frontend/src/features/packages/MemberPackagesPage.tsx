import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, Select } from '../../shared/components/ui';
import { errorMessage, isAbort } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import type { ApiPage, User } from '../../shared/types/api';
import { fetchAllMembers } from './packages.api';
import { formatCivilDate } from './packages.dates';
import type { MemberPackage, PackageStatus } from './packages.types';
import { packageStatusLabels } from './packages.types';

const PAGE_SIZE = 10;

export function MemberPackagesPage() {
  const { api, user } = useSession();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const [page, setPage] = useState(1);
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState<PackageStatus | ''>('');
  const [expiringSoon, setExpiringSoon] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [membersLoading, setMembersLoading] = useState(Boolean(isAdmin));
  const [membersError, setMembersError] = useState('');
  const [membersRevision, setMembersRevision] = useState(0);
  const [notice] = useState(() => typeof location.state?.notice === 'string' ? location.state.notice as string : '');

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    setMembersLoading(true); setMembersError('');
    fetchAllMembers(api).then((result) => { if (!controller.signal.aborted) setMembers(result); })
      .catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setMembersError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setMembersLoading(false); });
    return () => controller.abort();
  }, [api, isAdmin, membersRevision]);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (isAdmin && memberId) query.set('memberId', memberId);
  if (status) query.set('status', status);
  if (expiringSoon === 'true' || expiringSoon === 'false') query.set('expiringSoon', expiringSoon);
  const result = useResource<ApiPage<MemberPackage>>(`/member-packages?${query}`, true);

  useEffect(() => {
    if (!result.data) return;
    const lastPage = Math.max(1, Math.ceil(result.data.meta.total / PAGE_SIZE));
    if (page > lastPage) setPage(lastPage);
  }, [page, result.data]);

  const basePath = isAdmin ? '/admin/paquetes' : '/socio/paquetes';
  const heading = isAdmin ? 'Paquetes asignados' : 'Mis paquetes';

  return <>
    <PageHeader eyebrow={isAdmin ? 'ADMINISTRACIÓN / PAQUETES' : 'MI CUENTA'} title={heading} description={isAdmin ? 'Consultá la vigencia, el saldo y el estado de cada asignación.' : 'Revisá tus créditos, fechas de vigencia y próximos vencimientos.'} action={isAdmin ? <Link className="button primary" to="/admin/paquetes/asignar">+ Asignar paquete</Link> : undefined} />
    {notice && <Alert tone="success">{notice}</Alert>}
    <section className="card list-card">
      <div className="list-toolbar">
        {isAdmin && <Select label="Socio" value={memberId} disabled={membersLoading || Boolean(membersError)} onChange={(event) => { setMemberId(event.target.value); setPage(1); }}>
          <option value="">Todos los socios</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.active ? '' : ' (inactivo)'}</option>)}
        </Select>}
        <Select label="Estado" value={status} onChange={(event) => { setStatus(event.target.value as PackageStatus | ''); setPage(1); }}>
          <option value="">Todos los estados</option><option value="NOT_STARTED">Pendiente de inicio</option><option value="ACTIVE">Activo</option><option value="EXHAUSTED">Sin créditos</option><option value="EXPIRED">Vencido</option>
        </Select>
        <Select label="Próximo vencimiento" value={expiringSoon} onChange={(event) => { setExpiringSoon(event.target.value); setPage(1); }}>
          <option value="">Todos</option><option value="true">Próximos a vencer</option><option value="false">No próximos a vencer</option>
        </Select>
      </div>
      {membersLoading && isAdmin && <LoadingState label="Cargando catálogo de socios…" />}
      {membersError && isAdmin && <ErrorState message={membersError} retry={() => setMembersRevision((value) => value + 1)} />}
      {result.loading && <LoadingState label={result.data ? 'Actualizando paquetes…' : 'Cargando paquetes…'} />}
      {result.error && <ErrorState message={result.error} retry={result.refresh} />}
      {result.data && !result.error && (result.data.data.length ? <div className="table-scroll" aria-busy={result.loading}>
        <table><caption className="sr-only">{heading}</caption><thead><tr>{isAdmin && <th>Socio</th>}<th>Tipo</th><th>Inicio</th><th>Vencimiento</th><th>Saldo</th><th>Estado</th><th>Próximo vencimiento</th><th className="actions-heading">Detalle</th></tr></thead>
          <tbody>{result.data.data.map((item) => <tr key={item.id}>
            {isAdmin && <td>{item.member.name}</td>}<td><strong>{item.packageType.name}</strong></td><td>{formatCivilDate(item.startsOn)}</td><td>{formatCivilDate(item.expiresOn)}</td>
            <td>{item.remainingCredits} de {item.initialCredits}</td><td><span className={`badge ${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{packageStatusLabels[item.status]}</span></td>
            <td>{item.expiringSoon ? <span className="badge inactive">Próximo a vencer</span> : 'No próximo a vencer'}</td>
            <td><Link className="text-link" to={`${basePath}/${item.id}`} aria-label={`Ver detalle del paquete ${item.packageType.name} de ${item.member.name}`}>Ver detalle</Link></td>
          </tr>)}</tbody>
        </table>
      </div> : !result.loading && <EmptyState title={status || expiringSoon || memberId ? 'No hay coincidencias' : 'Todavía no hay paquetes'}>{status || expiringSoon || memberId ? 'Probá cambiar o quitar alguno de los filtros.' : isAdmin ? 'Las asignaciones aparecerán acá.' : 'Contactá con administración si esperabas encontrar una asignación.'}</EmptyState>)}
      {result.data && <Pagination page={page} pageSize={PAGE_SIZE} total={result.data.meta.total} onChange={setPage} />}
    </section>
  </>;
}
