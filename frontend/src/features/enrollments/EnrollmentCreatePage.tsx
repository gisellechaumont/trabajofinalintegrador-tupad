import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, ErrorState, LoadingState, PageHeader } from '../../shared/components/ui';
import { errorMessage, isAbort } from '../../shared/services/http';
import type { User } from '../../shared/types/api';
import { fetchAllActiveMembers } from '../packages/packages.api';
import { fetchAllClasses, fetchClass } from '../classes/classes.api';
import type { ClassView } from '../classes/classes.types';
import { formatBuenosAires } from '../classes/classes.dates';
import { createAdminEnrollment, getEnrollmentEligibility } from './enrollments.api';
import type { EnrollmentEligibility } from './enrollments.types';

function numericClassId(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function EnrollmentCreatePage() {
  const { api } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const queryId = new URLSearchParams(location.search).get('classId');
  const initialClassId = numericClassId(queryId);
  const [members, setMembers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassView[]>([]);
  const [memberId, setMemberId] = useState('');
  const [classId, setClassId] = useState(initialClassId ? String(initialClassId) : '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [classResolutionMessage, setClassResolutionMessage] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [eligibility, setEligibility] = useState<EnrollmentEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState('');
  const [eligibilityRevision, setEligibilityRevision] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setClassResolutionMessage('');
    Promise.all([fetchAllActiveMembers(api), fetchAllClasses(api, { status: 'SCHEDULED' })])
      .then(async ([activeMembers, scheduledClasses]) => {
        let options = scheduledClasses;
        if (initialClassId && !options.some((item) => item.id === initialClassId)) {
          try {
            const selected = await fetchClass(api, initialClassId);
            if (!controller.signal.aborted) options = [...options, selected.data];
          } catch (failure) {
            if (!controller.signal.aborted) setClassResolutionMessage(`No se pudo recuperar la clase preseleccionada: ${errorMessage(failure)}`);
          }
        }
        if (!controller.signal.aborted) { setMembers(activeMembers); setClasses([...new Map(options.map((item) => [item.id, item])).values()]); }
      })
      .catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setLoadError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, initialClassId, catalogRevision]);

  useEffect(() => {
    if (!memberId || !classId || !Number.isSafeInteger(Number(classId))) {
      setEligibility(null); setEligibilityError(''); setEligibilityLoading(false); return;
    }
    const controller = new AbortController();
    setEligibility(null); setEligibilityError(''); setEligibilityLoading(true);
    getEnrollmentEligibility(api, Number(classId), Number(memberId), controller.signal)
      .then((response) => { if (!controller.signal.aborted) setEligibility(response.data); })
      .catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setEligibilityError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setEligibilityLoading(false); });
    return () => controller.abort();
  }, [api, classId, memberId, eligibilityRevision]);

  async function submit() {
    if (busy) return;
    if (!memberId || !classId) { setFieldError('Seleccioná un socio y una clase.'); return; }
    if (!eligibility?.canEnroll) return;
    setBusy(true); setError('');
    try {
      const result = await createAdminEnrollment(api, { classId: Number(classId), memberId: Number(memberId) });
      setConfirmOpen(false);
      navigate(`/admin/inscripciones/${result.data.id}`, { replace: true, state: { notice: 'Inscripción creada correctamente.' } });
    } catch (failure) { setError(errorMessage(failure)); setConfirmOpen(false); }
    finally { setBusy(false); }
  }

  const selectedClass = classes.find((item) => String(item.id) === classId);
  const selectedMember = members.find((item) => String(item.id) === memberId);
  function handleSubmit(event: FormEvent) {
    event.preventDefault(); setFieldError(''); setError('');
    if (!memberId || !classId) { setFieldError('Seleccioná un socio y una clase.'); return; }
    if (eligibility?.canEnroll) setConfirmOpen(true);
  }

  return <>
    <Link className="back-link" to="/admin/inscripciones">← Volver a inscripciones</Link>
    <PageHeader eyebrow="ADMINISTRACIÓN / INSCRIPCIONES" title="Nueva inscripción" description="El sistema seleccionará automáticamente un paquete utilizable y descontará un crédito al confirmar." />
    {loadError && <ErrorState message={loadError} retry={() => setCatalogRevision((value) => value + 1)} />}
    {loading ? <LoadingState label="Cargando socios y clases…" /> : !loadError && (!members.length || !classes.length) ? <Alert tone="info">{!members.length ? 'No hay socios activos disponibles.' : 'No hay clases programadas disponibles.'}</Alert> : !loadError && <form className="card form-card narrow" onSubmit={handleSubmit} noValidate>
      {error && <Alert>{error}</Alert>}{fieldError && <Alert>{fieldError}</Alert>}
      <div className="field"><label htmlFor="enrollment-member">Socio activo</label><select id="enrollment-member" required value={memberId} disabled={busy} aria-invalid={Boolean(fieldError && !memberId)} aria-describedby={fieldError && !memberId ? 'member-error' : undefined} onChange={(event) => { setMemberId(event.target.value); setFieldError(''); }}><option value="">Seleccioná un socio</option>{members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError && !memberId && <small role="alert" id="member-error" className="field-error">Seleccioná un socio activo.</small>}</div>
      <div className="field"><label htmlFor="enrollment-class">Clase programada</label><select id="enrollment-class" required value={classId} disabled={busy} aria-invalid={Boolean(fieldError && !classId)} aria-describedby={fieldError && !classId ? 'class-error' : undefined} onChange={(event) => { setClassId(event.target.value); setFieldError(''); }}><option value="">Seleccioná una clase</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.activity.name} · {formatBuenosAires(item.startsAt)} · {item.professor.name}{item.status === 'CANCELLED' ? ' · Cancelada' : item.status !== 'SCHEDULED' ? ` · ${item.status}` : ''}</option>)}</select>{fieldError && !classId && <small role="alert" id="class-error" className="field-error">Seleccioná una clase.</small>}</div>
      {queryId && !initialClassId && <Alert>El classId de la dirección no es válido. Seleccioná una clase de la lista.</Alert>}
      {classResolutionMessage && <Alert>{classResolutionMessage} Podés elegir otra clase.</Alert>}
      {selectedClass && <p className="muted">Clase seleccionada: {selectedClass.activity.name}, {formatBuenosAires(selectedClass.startsAt)} · {selectedMember?.name ?? 'Seleccioná un socio para consultar elegibilidad.'}</p>}
      {eligibilityLoading && <LoadingState label="Consultando elegibilidad…" />}
      {eligibilityError && <ErrorState message={eligibilityError} retry={() => setEligibilityRevision((value) => value + 1)} />}
      {eligibility && <section className="card" aria-live="polite"><h2>{eligibility.canEnroll ? 'Puede inscribirse' : 'No puede inscribirse'}</h2><p>{eligibility.message}</p>{!eligibility.canEnroll && eligibility.reason && <p>Motivo: {eligibility.reason}</p>}{eligibility.canEnroll && <dl className="details"><div><dt>Paquete seleccionado</dt><dd>{eligibility.packageTypeName ?? `Paquete #${eligibility.memberPackageId}`}</dd></div><div><dt>Saldo actual</dt><dd>{eligibility.remainingCredits}</dd></div><div><dt>Saldo después de inscribir</dt><dd>{eligibility.remainingCreditsAfterEnrollment}</dd></div></dl>}</section>}
      <div className="form-actions"><Link className="button secondary" to="/admin/inscripciones">Cancelar</Link><Button type="submit" disabled={busy || eligibilityLoading || (Boolean(memberId && classId) && eligibility?.canEnroll !== true)}>{busy ? 'Creando…' : 'Revisar y confirmar'}</Button></div>
    </form>}
    <ConfirmDialog open={confirmOpen} busy={busy} title="Confirmar inscripción" confirmLabel="Crear inscripción" onClose={() => setConfirmOpen(false)} onConfirm={() => { void submit(); }}>
      <p>Se inscribirá a {selectedMember?.name} en {selectedClass?.activity.name}. Se utilizará {eligibility?.packageTypeName ?? `el paquete #${eligibility?.memberPackageId}`} y el saldo quedará en {eligibility?.remainingCreditsAfterEnrollment} créditos. El servidor volverá a validar cupo, inscripción y paquete al confirmar.</p>
    </ConfirmDialog>
  </>;
}
