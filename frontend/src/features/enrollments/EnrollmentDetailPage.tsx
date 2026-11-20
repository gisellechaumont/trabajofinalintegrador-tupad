import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, ErrorState, LoadingState, PageHeader } from '../../shared/components/ui';
import { ApiError, errorMessage } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import type { ApiData } from '../../shared/types/api';
import { formatBuenosAires } from '../classes/classes.dates';
import { cancelEnrollment } from './enrollments.api';
import type { EnrollmentRecord } from './enrollments.types';

function attendanceLabel(status: string) {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'PRESENT') return 'Presente';
  if (status === 'ABSENT') return 'Ausente';
  return status || 'Sin estado';
}

export function EnrollmentDetailPage() {
  const { id } = useParams();
  const { api, user } = useSession();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const basePath = isAdmin ? '/admin/inscripciones' : '/socio/inscripciones';
  const resource = useResource<ApiData<EnrollmentRecord>>(`/enrollments/${id ?? ''}`);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(typeof location.state?.notice === 'string' ? location.state.notice : '');

  async function confirmCancellation() {
    if (!id || busy || !resource.data || resource.data.data.cancelled) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await cancelEnrollment(api, id);
      resource.setData(response); setConfirmOpen(false); setNotice('Inscripción cancelada. Se reintegró el crédito al paquete utilizado.');
    } catch (failure) {
      setConfirmOpen(false);
      setError(failure instanceof ApiError && failure.code === 'CANCELLATION_WINDOW_CLOSED'
        ? `CANCELLATION_WINDOW_CLOSED: ${errorMessage(failure)}`
        : errorMessage(failure));
    } finally { setBusy(false); }
  }

  if (resource.loading && !resource.data) return <LoadingState label="Cargando detalle de la inscripción…" />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error || 'No se encontró la inscripción.'} retry={resource.refresh} />;
  const enrollment = resource.data.data;
  return <>
    <Link className="back-link" to={basePath}>← Volver a inscripciones</Link>
    <PageHeader eyebrow={isAdmin ? 'ADMINISTRACIÓN / INSCRIPCIONES' : 'MIS INSCRIPCIONES'} title={`Inscripción #${enrollment.id}`} description={`${enrollment.class.activity.name} · ${formatBuenosAires(enrollment.class.startsAt)}`} action={!enrollment.cancelled ? <Button variant="danger" aria-label={`Cancelar inscripción de ${enrollment.member.name} para ${enrollment.class.activity.name}`} onClick={() => { setError(''); setConfirmOpen(true); }}>Cancelar inscripción</Button> : undefined} />
    {notice && <Alert tone="success">{notice}</Alert>}{error && <Alert>{error}</Alert>}
    <section className="card detail-card"><dl className="details">
      {isAdmin && <div><dt>Socio</dt><dd>{enrollment.member.name}</dd></div>}
      <div><dt>Actividad</dt><dd>{enrollment.class.activity.name}</dd></div><div><dt>Profesor</dt><dd>{enrollment.class.professor.name}</dd></div>
      <div><dt>Inicio</dt><dd>{formatBuenosAires(enrollment.class.startsAt)}</dd></div><div><dt>Finalización</dt><dd>{formatBuenosAires(enrollment.class.endsAt)}</dd></div>
      <div><dt>Paquete utilizado</dt><dd>{enrollment.package.packageType.name} (#{enrollment.memberPackageId})</dd></div>
      <div><dt>Estado de inscripción</dt><dd>{enrollment.cancelled ? 'Cancelada' : 'Activa'}</dd></div>
      <div><dt>Asistencia</dt><dd>{attendanceLabel(enrollment.attendanceStatus)}</dd></div>
      {enrollment.cancelledAt && <div><dt>Cancelada el</dt><dd>{formatBuenosAires(enrollment.cancelledAt)}</dd></div>}
      <div><dt>Crédito reintegrado</dt><dd>{enrollment.creditRefunded ? 'Sí' : 'No'}</dd></div>
    </dl></section>
    <ConfirmDialog open={confirmOpen} busy={busy} title="Cancelar inscripción" confirmLabel="Confirmar cancelación" onClose={() => setConfirmOpen(false)} onConfirm={() => { void confirmCancellation(); }}>
      <p>Se cancelará la inscripción de {enrollment.member.name} a {enrollment.class.activity.name}. El servidor comprobará el plazo de dos horas y devolverá el crédito al paquete utilizado si la operación está permitida.</p>
    </ConfirmDialog>
  </>;
}
