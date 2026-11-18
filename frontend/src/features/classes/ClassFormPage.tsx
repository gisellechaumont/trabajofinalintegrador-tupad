import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ErrorState, Field, LoadingState, PageHeader, Select } from '../../shared/components/ui';
import { ApiError, errorMessage } from '../../shared/services/http';
import { createClass, fetchActiveClassActivities, fetchActiveClassProfessors, fetchClass, updateClass } from './classes.api';
import type { ClassOption, ClassView } from './classes.types';
import { buenosAiresInputToIso, isoToBuenosAiresInput } from './classes.dates';

export function ClassFormPage({ editing = false }: { editing?: boolean }) {
  const { api } = useSession(); const { id } = useParams(); const navigate = useNavigate();
  const [loadRevision, setLoadRevision] = useState(0);
  const [activities, setActivities] = useState<ClassOption[]>([]); const [professors, setProfessors] = useState<ClassOption[]>([]);
  const [current, setCurrent] = useState<ClassView | null>(null); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('');
  const [activityId, setActivityId] = useState(''); const [professorId, setProfessorId] = useState(''); const [startsAt, setStartsAt] = useState(''); const [endsAt, setEndsAt] = useState(''); const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    setLoading(true); setLoadError('');
    Promise.all([
      fetchActiveClassActivities(api), fetchActiveClassProfessors(api),
      editing && id ? fetchClass(api, id) : Promise.resolve(null),
    ]).then(([activityOptions, professorOptions, response]) => {
      if (!live) return;
      setActivities(activityOptions); setProfessors(professorOptions);
      if (response) {
        const row = response.data; setCurrent(row); setActivityId(String(row.activity.id)); setProfessorId(String(row.professor.id));
        setStartsAt(isoToBuenosAiresInput(row.startsAt)); setEndsAt(isoToBuenosAiresInput(row.endsAt)); setCapacity(String(row.capacity));
      }
    }).catch((failure: unknown) => { if (live) setLoadError(errorMessage(failure)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, editing, id, loadRevision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setFields({});
    try {
      const common = {
        capacity: Number(capacity),
        startsAt: buenosAiresInputToIso(startsAt),
        endsAt: buenosAiresInputToIso(endsAt),
      };
      if (!editing) {
        const created = await createClass(api, { ...common, activityId: Number(activityId), professorId: Number(professorId) });
        navigate(`/admin/clases/${created.data.id}`, { replace: true, state: { notice: 'Clase programada correctamente.' } });
        return;
      }
      if (!current || !id) return;
      const patch: Record<string, unknown> = {};
      if (Number(activityId) !== current.activity.id) patch.activityId = Number(activityId);
      if (Number(professorId) !== current.professor.id) patch.professorId = Number(professorId);
      if (startsAt !== isoToBuenosAiresInput(current.startsAt)) patch.startsAt = common.startsAt;
      if (endsAt !== isoToBuenosAiresInput(current.endsAt)) patch.endsAt = common.endsAt;
      if (common.capacity !== current.capacity) patch.capacity = common.capacity;
      if (Object.keys(patch).length === 0) {
        navigate(`/admin/clases/${id}`, { replace: true, state: { notice: 'No se detectaron cambios; la clase conserva sus datos.' } });
        return;
      }
      const updated = await updateClass(api, id, patch as Parameters<typeof updateClass>[2]);
      navigate(`/admin/clases/${updated.data.id}`, { replace: true, state: { notice: 'Cambios guardados correctamente.' } });
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally { setBusy(false); }
  }

  if (loading) return <LoadingState label="Cargando datos de la clase…" />;
  if (loadError) return <ErrorState message={loadError} retry={() => setLoadRevision((value) => value + 1)} />;
  if (editing && current && current.status !== 'SCHEDULED') return <><Link className="back-link" to={`/admin/clases/${id}`}>← Volver a la clase</Link><PageHeader title="Edición no disponible" description="Solo se pueden modificar clases futuras que todavía no comenzaron." /><Alert tone="info">La clase está {current.status === 'CANCELLED' ? 'cancelada' : current.status === 'IN_PROGRESS' ? 'en curso' : 'finalizada'} y no admite cambios.</Alert></>;
  const inactiveActivity = current && !activities.some((option) => option.id === current.activity.id);
  const inactiveProfessor = current && !professors.some((option) => option.id === current.professor.id);
  return <>
    <Link className="back-link" to={editing && id ? `/admin/clases/${id}` : '/admin/clases'}>← Volver a {editing ? 'la clase' : 'clases'}</Link>
    <PageHeader eyebrow="ADMINISTRACIÓN / CLASES" title={editing ? 'Editar clase' : 'Programar clase'} description="Los horarios se interpretan en la hora de Buenos Aires." />
    <form className="card form-card narrow" onSubmit={submit}>
      {error && <Alert>{error}</Alert>}
      <Select id="class-activity" label="Actividad" required aria-invalid={Boolean(fields.activityId)} aria-describedby={fields.activityId ? 'class-activity-error' : undefined} value={activityId} disabled={busy} onChange={(event) => setActivityId(event.target.value)}>
        <option value="" disabled>Seleccioná una actividad</option>
        {inactiveActivity && <option value={current.activity.id}>{current.activity.name} — inactivo — valor actual</option>}
        {activities.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </Select>{fields.activityId && <small id="class-activity-error" role="alert" className="field-error">{fields.activityId}</small>}
      <Select id="class-professor" label="Profesor" required aria-invalid={Boolean(fields.professorId)} aria-describedby={fields.professorId ? 'class-professor-error' : undefined} value={professorId} disabled={busy} onChange={(event) => setProfessorId(event.target.value)}>
        <option value="" disabled>Seleccioná un profesor</option>
        {inactiveProfessor && <option value={current.professor.id}>{current.professor.name} — inactivo — valor actual</option>}
        {professors.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </Select>{fields.professorId && <small id="class-professor-error" role="alert" className="field-error">{fields.professorId}</small>}
      <Field label="Fecha y hora de inicio" type="datetime-local" required value={startsAt} disabled={busy} onChange={(event) => setStartsAt(event.target.value)} error={fields.startsAt} />
      <Field label="Fecha y hora de finalización" type="datetime-local" required value={endsAt} disabled={busy} onChange={(event) => setEndsAt(event.target.value)} error={fields.endsAt} />
      <Field label="Capacidad" type="number" min="1" step="1" required value={capacity} disabled={busy} onChange={(event) => setCapacity(event.target.value)} error={fields.capacity} />
      <div className="form-actions"><Link className="button secondary" to={editing && id ? `/admin/clases/${id}` : '/admin/clases'}>Cancelar</Link><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Programar clase'}</Button></div>
    </form>
  </>;
}
