import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Alert, Button, ConfirmDialog, ErrorState, Field, LoadingState, PageHeader, Select } from '../../shared/components/ui';
import { ApiError, errorMessage } from '../../shared/services/http';
import { createClass, createClassesBatch, fetchActiveClassActivities, fetchActiveClassProfessors, fetchClass, updateClass } from './classes.api';
import type { ClassBatchCreateInput, ClassOption, ClassView } from './classes.types';
import { buenosAiresInputToIso, formatBuenosAiresDateKey, isoToBuenosAiresInput, weeklyClassDateKeys, weeklyClassRangeError } from './classes.dates';

const weekDays = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

export function ClassFormPage({ editing = false }: { editing?: boolean }) {
  const { api } = useSession(); const { id } = useParams(); const navigate = useNavigate();
  const [loadRevision, setLoadRevision] = useState(0);
  const [activities, setActivities] = useState<ClassOption[]>([]); const [professors, setProfessors] = useState<ClassOption[]>([]);
  const [current, setCurrent] = useState<ClassView | null>(null); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('');
  const [activityId, setActivityId] = useState(''); const [professorId, setProfessorId] = useState(''); const [startsAt, setStartsAt] = useState(''); const [endsAt, setEndsAt] = useState(''); const [capacity, setCapacity] = useState('');
  const [repeatMode, setRepeatMode] = useState<'none' | 'weekly'>('none'); const [weeklyStartDate, setWeeklyStartDate] = useState(''); const [weeklyStartTime, setWeeklyStartTime] = useState(''); const [weeklyEndTime, setWeeklyEndTime] = useState(''); const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]); const [repeatUntil, setRepeatUntil] = useState('');
  const [pendingBatch, setPendingBatch] = useState<ClassBatchCreateInput | null>(null);
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

  const weeklyDates = weeklyClassDateKeys(weeklyStartDate, daysOfWeek, repeatUntil);
  const weeklyRangeError = weeklyClassRangeError(weeklyStartDate, daysOfWeek, repeatUntil);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setFields({});
    try {
      if (!editing && repeatMode === 'weekly') {
        if (weeklyRangeError) {
          setError(weeklyRangeError);
          return;
        }
        const payload: ClassBatchCreateInput = {
          activityId: Number(activityId),
          professorId: Number(professorId),
          startsAt: buenosAiresInputToIso(`${weeklyStartDate}T${weeklyStartTime}`),
          endsAt: buenosAiresInputToIso(`${weeklyStartDate}T${weeklyEndTime}`),
          capacity: Number(capacity),
          daysOfWeek,
          repeatUntil,
        };
        setPendingBatch(payload);
        return;
      }
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

  async function confirmBatch() {
    if (!pendingBatch || busy) return;
    setBusy(true); setError('');
    try {
      const created = await createClassesBatch(api, pendingBatch);
      setPendingBatch(null);
      navigate('/admin/clases', { replace: true, state: { notice: `Se programaron ${created.data.length} clases correctamente.` } });
    } catch (failure) {
      setError(errorMessage(failure));
      setPendingBatch(null);
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
      {!editing && <Select id="class-repeat-mode" label="Repetición" required value={repeatMode} disabled={busy} onChange={(event) => setRepeatMode(event.target.value as 'none' | 'weekly')}>
        <option value="none">No repetir</option>
        <option value="weekly">Repetición semanal personalizada</option>
      </Select>}
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
      {repeatMode === 'weekly' && !editing ? <>
        <Field label="Fecha de inicio" type="date" required value={weeklyStartDate} disabled={busy} onChange={(event) => setWeeklyStartDate(event.target.value)} />
        <Field label="Hora de inicio" type="time" required value={weeklyStartTime} disabled={busy} onChange={(event) => setWeeklyStartTime(event.target.value)} error={fields.startsAt} />
        <Field label="Hora de finalización" type="time" required value={weeklyEndTime} disabled={busy} onChange={(event) => setWeeklyEndTime(event.target.value)} error={fields.endsAt} />
        <fieldset className="field" aria-describedby={weeklyRangeError ? 'class-weekly-error' : undefined}>
          <legend>Días de la semana</legend>
          {weekDays.map((day) => <label key={day.value}>
            <input type="checkbox" name="daysOfWeek" value={day.value} style={{ width: 'auto', minHeight: 'auto', padding: 0 }} checked={daysOfWeek.includes(day.value)} disabled={busy} onChange={(event) => setDaysOfWeek((currentDays) => event.target.checked ? [...currentDays, day.value].sort((a, b) => a - b) : currentDays.filter((value) => value !== day.value))} />
            {day.label}
          </label>)}
          {weeklyRangeError && <small id="class-weekly-error" role="alert" className="field-error">{weeklyRangeError}</small>}
        </fieldset>
        <Field label="Repetir hasta (inclusive)" type="date" required value={repeatUntil} disabled={busy} onChange={(event) => setRepeatUntil(event.target.value)} error={fields.repeatUntil} />
        <section aria-live="polite" aria-label="Vista previa de clases semanales">
          <h2>Vista previa</h2>
          {weeklyDates.length > 0
            ? <p>Se generarán {weeklyDates.length} clases. Primera fecha: {formatBuenosAiresDateKey(weeklyDates[0])}. Última fecha: {formatBuenosAiresDateKey(weeklyDates[weeklyDates.length - 1])}.</p>
            : <p>{weeklyRangeError || 'Seleccioná el rango y los días para ver las clases que se generarán.'}</p>}
        </section>
      </> : <>
        <Field label="Fecha y hora de inicio" type="datetime-local" required value={startsAt} disabled={busy} onChange={(event) => setStartsAt(event.target.value)} error={fields.startsAt} />
        <Field label="Fecha y hora de finalización" type="datetime-local" required value={endsAt} disabled={busy} onChange={(event) => setEndsAt(event.target.value)} error={fields.endsAt} />
      </>}
      <Field label="Capacidad" type="number" min="1" step="1" required value={capacity} disabled={busy} onChange={(event) => setCapacity(event.target.value)} error={fields.capacity} />
      <div className="form-actions"><Link className="button secondary" to={editing && id ? `/admin/clases/${id}` : '/admin/clases'}>Cancelar</Link><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : repeatMode === 'weekly' ? 'Revisar programación' : 'Programar clase'}</Button></div>
    </form>
    <ConfirmDialog open={Boolean(pendingBatch)} busy={busy} title="Confirmar programación semanal" confirmLabel={`Crear ${weeklyDates.length} clases`} onClose={() => setPendingBatch(null)} onConfirm={confirmBatch}>
      <p>Se crearán {weeklyDates.length} clases independientes, desde {weeklyDates.length ? formatBuenosAiresDateKey(weeklyDates[0]) : '—'} hasta {weeklyDates.length ? formatBuenosAiresDateKey(weeklyDates[weeklyDates.length - 1]) : '—'}. No se guardará una regla de repetición.</p>
    </ConfirmDialog>
  </>;
}
