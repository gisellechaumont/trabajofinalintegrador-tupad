import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, ErrorState, LoadingState, PageHeader } from '../../shared/components/ui';
import { errorMessage, isAbort } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import type { ApiData } from '../../shared/types/api';
import { cancelClass } from './classes.api';
import type { ClassCancellation, ClassView } from './classes.types';
import { formatBuenosAires } from './classes.dates';
import { createMemberEnrollment, getEnrollmentEligibility } from '../enrollments/enrollments.api';
import type { EnrollmentEligibility } from '../enrollments/enrollments.types';

export function ClassDetailPage() {
  const { id } = useParams(); const { api, user } = useSession(); const location = useLocation();
  const resource = useResource<ApiData<ClassView>>(`/classes/${id}`);
  const [confirmOpen, setConfirmOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [notice, setNotice] = useState(typeof location.state?.notice === 'string' ? location.state.notice : '');
  const [enrollConfirmOpen, setEnrollConfirmOpen] = useState(false); const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollError, setEnrollError] = useState(''); const [eligibility, setEligibility] = useState<EnrollmentEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false); const [eligibilityError, setEligibilityError] = useState('');
  const [eligibilityRevision, setEligibilityRevision] = useState(0);
  const isMember = user?.role === 'MEMBER';
  const currentClass = resource.data?.data;

  useEffect(() => {
    if (!id || !isMember || !currentClass || currentClass.status !== 'SCHEDULED') {
      setEligibility(null); setEligibilityError(''); setEligibilityLoading(false); return;
    }
    const controller = new AbortController();
    setEligibility(null); setEligibilityError(''); setEligibilityLoading(true);
    getEnrollmentEligibility(api, Number(id), undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setEligibility(result.data); })
      .catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setEligibilityError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setEligibilityLoading(false); });
    return () => controller.abort();
  }, [api, id, isMember, currentClass?.status, eligibilityRevision]);

  if (resource.loading && !resource.data) return <LoadingState label="Cargando detalle de la clase…" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || 'No se encontró la clase.'} retry={resource.refresh} />;
  const gymClass = resource.data.data; const isAdmin = user?.role === 'ADMIN'; const canMutate = isAdmin && gymClass.status === 'SCHEDULED';
  async function confirmCancellation() {
    if (!id || busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const response = await cancelClass(api, id); resource.setData({ data: response.data.class }); setConfirmOpen(false);
      const result: ClassCancellation = response.data;
      setNotice(result.refundedCredits > 0 ? `Clase cancelada. Se reintegraron ${result.refundedCredits} créditos.` : 'Clase cancelada correctamente.');
    } catch (failure) { setError(errorMessage(failure)); setConfirmOpen(false); }
    finally { setBusy(false); }
  }
  async function confirmEnrollment() {
    if (!id || enrollBusy || !eligibility?.canEnroll) return;
    setEnrollBusy(true); setEnrollError(''); setNotice('');
    try {
      await createMemberEnrollment(api, { classId: Number(id) });
      setEnrollConfirmOpen(false); setNotice('Inscripción confirmada. Se descontó un crédito del paquete seleccionado.');
      setEligibility(null); setEligibilityLoading(true); setEligibilityRevision((value) => value + 1);
    } catch (failure) { setEnrollConfirmOpen(false); setEnrollError(errorMessage(failure)); }
    finally { setEnrollBusy(false); }
  }
  const eligibilityReasons: Record<string, string> = {
    CLASS_FULL: 'La clase está completa.', CLASS_CANCELLED: 'La clase está cancelada.', CLASS_STARTED: 'La clase ya comenzó.',
    ALREADY_ENROLLED: 'Ya tenés una inscripción activa para esta clase.', NO_USABLE_PACKAGE: 'No tenés un paquete utilizable para esta clase.',
  };
  return <>
    <Link className="back-link" to={user?.role === 'ADMIN' ? '/admin/clases' : user?.role === 'PROFESSOR' ? '/profesor/clases' : '/socio/clases'}>← Volver a clases</Link>
    <PageHeader eyebrow="CLASES / DETALLE" title={gymClass.activity.name} description={`${gymClass.status === 'CANCELLED' ? 'Clase cancelada' : 'Detalle de clase'} · ${formatBuenosAires(gymClass.startsAt)}`} action={canMutate ? <div className="row-actions"><Link className="button secondary" to={`/admin/clases/${id}/editar`}>Editar</Link><Button variant="danger" onClick={() => { setError(''); setConfirmOpen(true); }}>Cancelar clase</Button><Link className="button secondary" to={`/admin/inscripciones/nueva?classId=${id}`}>Inscribir socio</Link></div> : undefined} />
    {notice && <Alert tone="success">{notice}</Alert>}{error && <Alert>{error}</Alert>}
    {user?.role === 'PROFESSOR' && gymClass.professor.id === user.id && <Alert tone="info">Esta es tu clase asignada.</Alert>}
    {user?.role === 'MEMBER' && gymClass.status === 'CANCELLED' && <Alert tone="info">Esta clase está cancelada y no está disponible como oferta.</Alert>}
    {isMember && gymClass.status === 'SCHEDULED' && <section className="card" aria-live="polite">
      <h2>Inscripción</h2>
      {eligibilityLoading && <LoadingState label="Consultando si podés inscribirte…" />}
      {eligibilityError && <ErrorState message={eligibilityError} retry={() => setEligibilityRevision((value) => value + 1)} />}
      {eligibility && (eligibility.canEnroll ? <>
        <p>{eligibility.message}</p><dl className="details"><div><dt>Paquete seleccionado</dt><dd>{eligibility.packageTypeName ?? `Paquete #${eligibility.memberPackageId}`}</dd></div><div><dt>Saldo actual</dt><dd>{eligibility.remainingCredits}</dd></div><div><dt>Saldo después de inscribirte</dt><dd>{eligibility.remainingCreditsAfterEnrollment}</dd></div></dl>
        <Button disabled={enrollBusy} onClick={() => { setEnrollError(''); setEnrollConfirmOpen(true); }}>{enrollBusy ? 'Inscribiendo…' : 'Inscribirme'}</Button>
      </> : <><p>{eligibility.reason ? eligibilityReasons[eligibility.reason] ?? eligibility.reason : 'No podés inscribirte en esta clase.'}</p>{eligibility.reason && <p>Motivo: {eligibility.reason}</p>}<p>{eligibility.message}</p></>)}
      {enrollError && <Alert>{enrollError}</Alert>}
    </section>}
    <section className="card detail-card"><dl className="details">
      <div><dt>Actividad</dt><dd>{gymClass.activity.name}</dd></div><div><dt>Profesor</dt><dd>{gymClass.professor.name}</dd></div>
      <div><dt>Inicio</dt><dd>{formatBuenosAires(gymClass.startsAt)}</dd></div><div><dt>Finalización</dt><dd>{formatBuenosAires(gymClass.endsAt)}</dd></div>
      <div><dt>Estado</dt><dd>{gymClass.status === 'SCHEDULED' ? 'Programada' : gymClass.status === 'IN_PROGRESS' ? 'En curso' : gymClass.status === 'FINISHED' ? 'Finalizada' : 'Cancelada'}</dd></div>
      <div><dt>Capacidad</dt><dd>{gymClass.capacity}</dd></div><div><dt>Ocupación</dt><dd>{gymClass.occupiedSpots} inscripciones activas</dd></div>
      <div><dt>Cupos disponibles</dt><dd>{gymClass.availableSpots > 0 ? `${gymClass.availableSpots} de ${gymClass.capacity}` : 'Sin cupos'}</dd></div>
    </dl></section>
    <ConfirmDialog open={confirmOpen} busy={busy} title="Cancelar clase" confirmLabel="Confirmar cancelación" onClose={() => setConfirmOpen(false)} onConfirm={confirmCancellation}>
      <p>Se cancelará {gymClass.activity.name} del {formatBuenosAires(gymClass.startsAt)}. Las inscripciones activas se cancelarán y sus créditos se reintegrarán.</p>
    </ConfirmDialog>
    <ConfirmDialog open={enrollConfirmOpen} busy={enrollBusy} title="Confirmar inscripción" confirmLabel="Confirmar inscripción" onClose={() => setEnrollConfirmOpen(false)} onConfirm={() => { void confirmEnrollment(); }}>
      <p>Te vas a inscribir a {gymClass.activity.name}. Se utilizará {eligibility?.packageTypeName ?? `el paquete #${eligibility?.memberPackageId}`} y el saldo quedará en {eligibility?.remainingCreditsAfterEnrollment} créditos. El servidor volverá a comprobar la disponibilidad al confirmar.</p>
    </ConfirmDialog>
  </>;
}
