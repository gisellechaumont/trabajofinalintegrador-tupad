import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, ErrorState, LoadingState, PageHeader } from '../../shared/components/ui';
import { errorMessage } from '../../shared/services/http';
import { useResource } from '../../shared/services/useResource';
import type { ApiData } from '../../shared/types/api';
import { cancelClass } from './classes.api';
import type { ClassCancellation, ClassView } from './classes.types';
import { formatBuenosAires } from './classes.dates';

export function ClassDetailPage() {
  const { id } = useParams(); const { api, user } = useSession(); const location = useLocation();
  const resource = useResource<ApiData<ClassView>>(`/classes/${id}`);
  const [confirmOpen, setConfirmOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [notice, setNotice] = useState(typeof location.state?.notice === 'string' ? location.state.notice : '');
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
  return <>
    <Link className="back-link" to={user?.role === 'ADMIN' ? '/admin/clases' : user?.role === 'PROFESSOR' ? '/profesor/clases' : '/socio/clases'}>← Volver a clases</Link>
    <PageHeader eyebrow="CLASES / DETALLE" title={gymClass.activity.name} description={`${gymClass.status === 'CANCELLED' ? 'Clase cancelada' : 'Detalle de clase'} · ${formatBuenosAires(gymClass.startsAt)}`} action={canMutate ? <div className="row-actions"><Link className="button secondary" to={`/admin/clases/${id}/editar`}>Editar</Link><Button variant="danger" onClick={() => { setError(''); setConfirmOpen(true); }}>Cancelar clase</Button></div> : undefined} />
    {notice && <Alert tone="success">{notice}</Alert>}{error && <Alert>{error}</Alert>}
    {user?.role === 'PROFESSOR' && gymClass.professor.id === user.id && <Alert tone="info">Esta es tu clase asignada.</Alert>}
    {user?.role === 'MEMBER' && gymClass.status === 'CANCELLED' && <Alert tone="info">Esta clase está cancelada y no está disponible como oferta.</Alert>}
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
  </>;
}
