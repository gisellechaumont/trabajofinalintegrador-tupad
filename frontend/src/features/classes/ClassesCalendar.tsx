import { Link } from 'react-router-dom';
import { Button, EmptyState, ErrorState, LoadingState } from '../../shared/components/ui';
import type { Role } from '../../shared/types/api';
import type { ClassStatus, ClassView } from './classes.types';
import { addDaysToDateKey, buenosAiresDateKey, buenosAiresWeekDateKeys, buenosAiresWeekStartKey, formatBuenosAires, formatBuenosAiresDateKey } from './classes.dates';

const statusLabels: Record<ClassStatus, string> = {
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En curso',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

interface ClassesCalendarProps {
  weekStart: string;
  classes: ClassView[];
  loading: boolean;
  error: string;
  role: Role;
  professorId: number;
  detailBasePath: string;
  onWeekStartChange(value: string): void;
  onRetry(): void;
}

export function ClassesCalendar({ weekStart, classes, loading, error, role, professorId, detailBasePath, onWeekStartChange, onRetry }: ClassesCalendarProps) {
  const days = buenosAiresWeekDateKeys(weekStart);
  const today = buenosAiresDateKey(new Date());
  const grouped = new Map(days.map((day) => [day, [] as ClassView[]]));
  for (const gymClass of classes) {
    const day = buenosAiresDateKey(gymClass.startsAt);
    grouped.get(day)?.push(gymClass);
  }
  for (const dayClasses of grouped.values()) dayClasses.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id);

  const rangeLabel = `${formatBuenosAiresDateKey(weekStart)} – ${formatBuenosAiresDateKey(addDaysToDateKey(weekStart, 6))}`;
  return <section className="class-calendar card" aria-label={`Calendario semanal: ${rangeLabel}`}>
    <div className="class-calendar-toolbar">
      <Button variant="secondary" type="button" onClick={() => onWeekStartChange(addDaysToDateKey(weekStart, -7))}>Semana anterior</Button>
      <h2 aria-live="polite">Semana del {rangeLabel}</h2>
      <div className="class-calendar-navigation">
        <Button variant="secondary" type="button" onClick={() => onWeekStartChange(addDaysToDateKey(weekStart, 7))}>Semana siguiente</Button>
        <Button variant="ghost" type="button" onClick={() => onWeekStartChange(buenosAiresWeekStartKey())}>Ir a la semana actual</Button>
      </div>
    </div>
    {loading && <LoadingState label={classes.length ? 'Actualizando calendario…' : 'Cargando calendario…'} />}
    {error && <ErrorState message={error} retry={onRetry} />}
    {!loading && !error && classes.length === 0 && <EmptyState title={`No hay clases para la semana del ${rangeLabel}`}>
      No encontramos clases que coincidan con los filtros seleccionados.
    </EmptyState>}
    <div className="class-week-grid" aria-label="Días de la semana">
      {days.map((day) => {
        const dayClasses = grouped.get(day) ?? [];
        return <section className="class-week-day" key={day} aria-labelledby={`class-day-${day}`}>
          <h3 id={`class-day-${day}`}>{formatBuenosAiresDateKey(day)}{day === today ? ' · Hoy' : ''}</h3>
          {dayClasses.length === 0 ? <p className="muted class-week-empty">Sin clases</p> : <ul className="class-week-list">
            {dayClasses.map((gymClass) => {
              const availability = gymClass.availableSpots === 0 ? 'Sin cupos' : `${gymClass.availableSpots} cupos disponibles`;
              const ownClass = role === 'PROFESSOR' && gymClass.professor.id === professorId;
              return <li key={gymClass.id}>
                <Link className="class-week-item" to={`${detailBasePath}/${gymClass.id}`} aria-label={`Clase ${gymClass.activity.name}, ${formatBuenosAires(gymClass.startsAt)}, profesor ${gymClass.professor.name}, estado ${statusLabels[gymClass.status]}, ${availability}. Ver detalle`}>
                  <strong>{gymClass.activity.name}</strong>
                  <span>{formatBuenosAires(gymClass.startsAt, false)} · {gymClass.professor.name}</span>
                  <span className={`badge ${gymClass.status === 'CANCELLED' ? 'inactive' : 'active'}`}>{statusLabels[gymClass.status]}</span>
                  <span className="class-week-availability">{availability}</span>
                  {ownClass && <span className="badge active">Tu clase</span>}
                </Link>
              </li>;
            })}
          </ul>}
        </section>;
      })}
    </div>
  </section>;
}
