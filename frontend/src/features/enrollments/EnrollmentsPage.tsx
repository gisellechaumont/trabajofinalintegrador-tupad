import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, Select } from '../../shared/components/ui';
import { useResource } from '../../shared/services/useResource';
import { errorMessage } from '../../shared/services/http';
import type { ApiPage, User } from '../../shared/types/api';
import { fetchAllMembers } from '../packages/packages.api';
import { fetchAllClasses } from '../classes/classes.api';
import { buenosAiresDayBoundaryToIso, formatBuenosAires } from '../classes/classes.dates';
import type { ClassView } from '../classes/classes.types';
import type { EnrollmentRecord, EnrollmentsQuery, MemberEnrollmentView } from './enrollments.types';

const PAGE_SIZE = 10;

function attendanceLabel(status: string) {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'PRESENT') return 'Presente';
  if (status === 'ABSENT') return 'Ausente';
  return status || 'Sin estado';
}

export function EnrollmentsPage() {
  const { api, user } = useSession();
  const isAdmin = user?.role === 'ADMIN';
  const [page, setPage] = useState(1);
  const [memberId, setMemberId] = useState('');
  const [classId, setClassId] = useState('');
  const [cancelled, setCancelled] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [memberView, setMemberView] = useState<MemberEnrollmentView>('upcoming');
  const [memberReferenceTime, setMemberReferenceTime] = useState(() => new Date().toISOString());
  const [members, setMembers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassView[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(Boolean(isAdmin));
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    setCatalogLoading(true); setCatalogError('');
    Promise.all([fetchAllMembers(api), fetchAllClasses(api)])
      .then(([allMembers, allClasses]) => {
        if (!controller.signal.aborted) { setMembers(allMembers); setClasses(allClasses); }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setCatalogError(errorMessage(failure));
      })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [api, isAdmin, catalogRevision]);

  const query: EnrollmentsQuery = { page, pageSize: PAGE_SIZE };
  if (isAdmin) {
    if (memberId) query.memberId = Number(memberId);
    if (classId) query.classId = Number(classId);
    if (cancelled === 'true' || cancelled === 'false') query.cancelled = cancelled === 'true';
    if (from) query.from = buenosAiresDayBoundaryToIso(from);
    if (to) query.to = buenosAiresDayBoundaryToIso(to);
  } else {
    if (memberView === 'upcoming') { query.cancelled = false; query.from = memberReferenceTime; }
    if (memberView === 'past') { query.cancelled = false; query.to = memberReferenceTime; }
    if (memberView === 'cancelled') query.cancelled = true;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  const result = useResource<ApiPage<EnrollmentRecord>>(`/enrollments?${params.toString()}`, true);
  const heading = isAdmin ? 'Inscripciones' : 'Mis inscripciones';
  const basePath = isAdmin ? '/admin/inscripciones' : '/socio/inscripciones';

  useEffect(() => {
    if (!result.data) return;
    const lastPage = Math.max(1, Math.ceil(result.data.meta.total / PAGE_SIZE));
    if (page > lastPage) setPage(lastPage);
  }, [page, result.data]);

  return <>
    <PageHeader eyebrow={isAdmin ? 'ADMINISTRACIÓN / INSCRIPCIONES' : 'MI CUENTA'} title={heading} description={isAdmin ? 'Consultá las inscripciones y sus estados.' : 'Consultá tus próximas, pasadas y canceladas.'} action={isAdmin ? <Link className="button primary" to={`${basePath}/nueva`}>+ Nueva inscripción</Link> : undefined} />
    {catalogLoading && isAdmin && <LoadingState label="Cargando catálogos de filtros…" />}
    {catalogError && isAdmin && <ErrorState message={catalogError} retry={() => setCatalogRevision((value) => value + 1)} />}
    <section className="card list-card">
      <div className="list-toolbar">
        {isAdmin ? <>
          <Select label="Socio" value={memberId} disabled={catalogLoading || Boolean(catalogError)} onChange={(event) => { setMemberId(event.target.value); setPage(1); }}><option value="">Todos los socios</option>{members.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (inactivo)'}</option>)}</Select>
          <Select label="Clase" value={classId} disabled={catalogLoading || Boolean(catalogError)} onChange={(event) => { setClassId(event.target.value); setPage(1); }}><option value="">Todas las clases</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.activity.name} · {formatBuenosAires(item.startsAt)}</option>)}</Select>
          <Select label="Estado de inscripción" value={cancelled} onChange={(event) => { setCancelled(event.target.value); setPage(1); }}><option value="">Todas</option><option value="false">Activas</option><option value="true">Canceladas</option></Select>
          <div className="field"><label htmlFor="enrollment-from">Desde (inclusive)</label><input id="enrollment-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></div>
          <div className="field"><label htmlFor="enrollment-to">Hasta (exclusivo)</label><input id="enrollment-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div>
        </> : <Select label="Mostrar" value={memberView} onChange={(event) => { setMemberReferenceTime(new Date().toISOString()); setMemberView(event.target.value as MemberEnrollmentView); setPage(1); }}>
          <option value="upcoming">Próximas activas</option><option value="past">Pasadas</option><option value="cancelled">Canceladas</option><option value="all">Todas</option>
        </Select>}
      </div>
      {result.loading && <LoadingState label={result.data ? 'Actualizando inscripciones…' : 'Cargando inscripciones…'} />}
      {result.error && <ErrorState message={result.error} retry={result.refresh} />}
      {result.data && !result.error && (result.data.data.length ? <div className="table-scroll" aria-busy={result.loading}>
        <table><caption className="sr-only">{heading}</caption><thead><tr>{isAdmin && <th>Socio</th>}<th>Actividad y horario</th><th>Profesor</th><th>Paquete utilizado</th><th>Inscripción</th><th>Asistencia</th><th>Detalle</th></tr></thead>
          <tbody>{result.data.data.map((item) => <tr key={item.id}>
            {isAdmin && <td>{item.member.name}</td>}<td><strong>{item.class.activity.name}</strong><br />{formatBuenosAires(item.class.startsAt)} – {formatBuenosAires(item.class.endsAt, false)}</td><td>{item.class.professor.name}</td><td>{item.package.packageType.name} · {item.package.remainingCredits} créditos actuales</td>
            <td>{item.cancelled ? 'Cancelada' : 'Activa'}</td><td>{attendanceLabel(item.attendanceStatus)}</td><td><Link className="text-link" aria-label={`Ver inscripción de ${item.member.name} para ${item.class.activity.name}`} to={`${basePath}/${item.id}`}>Ver detalle</Link></td>
          </tr>)}</tbody>
        </table>
      </div> : !result.loading && <EmptyState title="No hay inscripciones para mostrar">{isAdmin ? 'Probá cambiar los filtros o crear una inscripción.' : memberView === 'upcoming' ? 'No tenés próximas inscripciones activas.' : 'No hay inscripciones que coincidan con esta vista.'}</EmptyState>)}
      {result.data && <Pagination page={page} pageSize={PAGE_SIZE} total={result.data.meta.total} onChange={setPage} />}
    </section>
  </>;
}
