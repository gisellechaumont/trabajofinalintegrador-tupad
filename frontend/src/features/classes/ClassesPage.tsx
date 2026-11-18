import {
    useEffect,
    useState,
} from 'react';
import {
    Link,
    useLocation,
} from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import {
    Alert,
    Button,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Field,
    LoadingState,
    PageHeader,
    Pagination,
    Select,
} from '../../shared/components/ui';
import {
    errorMessage,
} from '../../shared/services/http';
import {
    useResource,
} from '../../shared/services/useResource';
import type {
    ApiPage,
    Role,
} from '../../shared/types/api';
import {
    cancelClass,
    fetchClassActivityOptions,
    fetchClassProfessorCatalog,
    fetchClassProfessorOptions,
    fetchAllClasses,
} from './classes.api';
import { buenosAiresDayBoundaryToIso, buenosAiresWeekRange, buenosAiresWeekStartKey, formatBuenosAires } from './classes.dates';
import { ClassesCalendar } from './ClassesCalendar';
import type {
    ClassStatus,
    ClassOption,
    ClassView,
} from './classes.types';

const statusLabels: Record<
    ClassStatus,
    string
> = {
    SCHEDULED: 'Programada',
    IN_PROGRESS: 'En curso',
    FINISHED: 'Finalizada',
    CANCELLED: 'Cancelada',
};

function classesPath(role: Role) {
    if (role === 'ADMIN') {
        return '/admin/clases';
    }

    if (role === 'PROFESSOR') {
        return '/profesor/clases';
    }

    return '/socio/clases';
}

function ClassStatusBadge({
    status,
}: {
    status: ClassStatus;
}) {
    return (
        <span
            className={
                `badge ${status === 'CANCELLED'
                    ? 'inactive'
                    : 'active'
                }`
            }
        >
            <span
                aria-hidden="true"
                className="status-dot"
            />

            {statusLabels[status]}
        </span>
    );
}

export function ClassesPage() {
    const location = useLocation();
    const { api, user } = useSession();

    const [page, setPage] = useState(1);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [calendarWeekStart, setCalendarWeekStart] = useState(() => buenosAiresWeekStartKey());
    const [calendarClasses, setCalendarClasses] = useState<ClassView[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarError, setCalendarError] = useState('');
    const [calendarRevision, setCalendarRevision] = useState(0);

    const [status, setStatus] =
        useState<ClassStatus | ''>('');

    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [activityId, setActivityId] = useState('');
    const [professorId, setProfessorId] = useState('');
    const [onlyMine, setOnlyMine] = useState(false);
    const [activities, setActivities] = useState<ClassOption[]>([]);
    const [professors, setProfessors] = useState<ClassOption[]>([]);
    const [optionsError, setOptionsError] = useState('');

    const [pending, setPending] =
        useState<ClassView | null>(null);

    const [busy, setBusy] =
        useState(false);

    const [error, setError] =
        useState('');

    const [notice, setNotice] =
        useState(() =>
            typeof location.state?.notice ===
                'string'
                ? location.state.notice as string
                : '',
        );

    useEffect(() => {
        let active = true;
        const professorOptions = user?.role === 'ADMIN'
            ? fetchClassProfessorCatalog(api)
            : fetchClassProfessorOptions(api);
        Promise.all([fetchClassActivityOptions(api), professorOptions])
            .then(([activityOptions, professorList]) => {
                if (active) { setActivities(activityOptions); setProfessors(professorList); }
            })
            .catch((failure: unknown) => { if (active) setOptionsError(errorMessage(failure)); });
        return () => { active = false; };
    }, [api, user?.role]);

    const fromInstant = from ? buenosAiresDayBoundaryToIso(from) : undefined;
    const toInstant = to ? buenosAiresDayBoundaryToIso(to, true) : undefined;

    const query = new URLSearchParams({
        page: String(page),
        pageSize: '10',

        ...(user?.role === 'MEMBER' ? { status: 'SCHEDULED' } : status ? { status } : {}),

        ...(fromInstant
            ? { from: fromInstant }
            : {}),

        ...(toInstant
            ? { to: toInstant }
            : {}),
        ...(activityId ? { activityId } : {}),
        ...(onlyMine && user?.role === 'PROFESSOR' ? { professorId: String(user.id) } : professorId ? { professorId } : {}),
    });

    const result =
        useResource<ApiPage<ClassView>>(
            `/classes?${query}`,
            true,
        );

    const calendarRange = buenosAiresWeekRange(calendarWeekStart);
    useEffect(() => {
        if (viewMode !== 'calendar' || !user) return;
        let active = true;
        setCalendarLoading(true);
        setCalendarError('');
        setCalendarClasses([]);
        fetchAllClasses(api, {
            from: calendarRange.from,
            to: calendarRange.to,
            ...(user.role === 'MEMBER' ? { status: 'SCHEDULED' as const } : status ? { status } : {}),
            ...(activityId ? { activityId: Number(activityId) } : {}),
            ...(onlyMine && user.role === 'PROFESSOR' ? { professorId: user.id } : professorId ? { professorId: Number(professorId) } : {}),
        }).then((classes) => { if (active) setCalendarClasses(classes); })
            .catch((failure: unknown) => { if (active) setCalendarError(errorMessage(failure)); })
            .finally(() => { if (active) setCalendarLoading(false); });
        return () => { active = false; };
    }, [api, viewMode, calendarWeekStart, calendarRange.from, calendarRange.to, user?.role, user?.id, status, activityId, professorId, onlyMine, calendarRevision]);

    useEffect(() => {
        if (!result.data) return;

        const lastPage = Math.max(
            1,
            Math.ceil(
                result.data.meta.total / 10,
            ),
        );

        if (page > lastPage) {
            setPage(lastPage);
        }
    }, [result.data, page]);

    if (!user) return null;

    const basePath =
        classesPath(user.role);

    const isAdmin =
        user.role === 'ADMIN';

    async function confirmCancellation() {
        if (!pending || busy) return;

        setBusy(true);
        setError('');
        setNotice('');

        try {
            const response =
                await cancelClass(
                    api,
                    pending.id,
                );

            result.setData((previous) =>
                previous
                    ? {
                        ...previous,

                        data: previous.data.map(
                            (row) =>
                                row.id === pending.id
                                    ? response.data.class
                                    : row,
                        ),
                    }
                    : previous,
            );

            setPending(null);

            setNotice(
                response.data.refundedCredits > 0
                    ? `Clase cancelada. Se reintegraron ${response.data.refundedCredits} créditos.`
                    : 'Clase cancelada correctamente.',
            );

            result.refresh();
        } catch (failure) {
            setError(
                errorMessage(failure),
            );

            setPending(null);
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <PageHeader
                eyebrow={
                    isAdmin
                        ? 'ADMINISTRACIÓN / AGENDA'
                        : 'AGENDA'
                }
                title={
                    user.role === 'PROFESSOR'
                        ? onlyMine ? 'Mis clases' : 'Agenda general'
                        : 'Clases'
                }
                description={
                    isAdmin
                        ? 'Programá clases, controlá sus cupos y administrá cambios o cancelaciones.'
                        : 'Consultá horarios, actividades, profesores y cupos disponibles.'
                }
                action={
                    isAdmin
                        ? (
                            <Link
                                className="button primary"
                                to={`${basePath}/nueva`}
                            >
                                + Programar clase
                            </Link>
                        )
                        : undefined
                }
            />

            <div className="class-view-switch" role="group" aria-label="Vista de clases">
                <Button type="button" variant={viewMode === 'list' ? 'primary' : 'secondary'} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>Ver listado</Button>
                <Button type="button" variant={viewMode === 'calendar' ? 'primary' : 'secondary'} aria-pressed={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>Ver calendario semanal</Button>
            </div>

            {notice && (
                <Alert tone="success">
                    {notice}
                </Alert>
            )}

            {error && (
                <Alert>
                    {error}
                </Alert>
            )}

            <section className="card list-card">
                <div className="list-toolbar">
                    <Select label="Actividad" value={activityId} onChange={(event) => { setActivityId(event.target.value); setPage(1); }}>
                        <option value="">Todas las actividades</option>
                        {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
                    </Select>
                    <Select label="Profesor" value={professorId} disabled={onlyMine} onChange={(event) => { setProfessorId(event.target.value); setPage(1); }}>
                        <option value="">Todos los profesores</option>
                        {professors.map((professor) => <option key={professor.id} value={professor.id}>{professor.name}</option>)}
                    </Select>
                    {user.role === 'PROFESSOR' && <div className="field"><span>Mis clases</span><label><input type="checkbox" style={{ width: 'auto', minHeight: 'auto', padding: 0 }} checked={onlyMine} onChange={(event) => { setOnlyMine(event.target.checked); setProfessorId(''); setPage(1); }} /> Solo mis clases</label></div>}
                    {viewMode === 'list' && <>
                    <Field
                        label="Desde"
                        type="date"
                        value={from}
                        onChange={(event) => {
                            setFrom(event.target.value);
                            if (to && event.target.value > to) setTo('');

                            setPage(1);
                        }}
                    />

                    <Field
                        label="Hasta"
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(event) => {
                            setTo(
                                event.target.value,
                            );

                            setPage(1);
                        }}
                    />
                    </>}

                    {user.role !== 'MEMBER' && <Select
                        label="Estado"
                        value={status}
                        onChange={(event) =>
                            { setStatus(event.target.value as ClassStatus | ''); setPage(1); }
                        }
                    >
                        <option value="">
                            Todos los estados
                        </option>

                        <option value="SCHEDULED">
                            Programadas
                        </option>

                        <option value="IN_PROGRESS">
                            En curso
                        </option>

                        <option value="FINISHED">
                            Finalizadas
                        </option>

                        <option value="CANCELLED">
                            Canceladas
                        </option>
                    </Select>}
                </div>

                {optionsError && <Alert>Algunos filtros no pudieron cargarse: {optionsError}</Alert>}

                {viewMode === 'list' && result.loading && (
                    <LoadingState
                        label={
                            result.data
                                ? 'Actualizando clases…'
                                : 'Cargando clases…'
                        }
                    />
                )}

                {viewMode === 'list' && result.error && (
                    <ErrorState
                        message={result.error}
                        retry={result.refresh}
                    />
                )}

                {viewMode === 'list' && result.data &&
                    !result.error &&
                    (
                        result.data.data.length
                            ? (
                                <div
                                    className="table-scroll"
                                    aria-busy={
                                        result.loading
                                    }
                                >
                                    <table>
                                        <caption className="sr-only">
                                            Listado de clases
                                        </caption>

                                        <thead>
                                            <tr>
                                                <th>Actividad</th>
                                                <th>
                                                    Fecha y horario
                                                </th>
                                                <th>Profesor</th>
                                                <th>Cupos</th>
                                                <th>Estado</th>

                                                <th className="actions-heading">
                                                    Acciones
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {result.data.data.map(
                                                (gymClass) => (
                                                    <tr
                                                        key={
                                                            gymClass.id
                                                        }
                                                    >
                                                        <td>
                                                            <strong>
                                                                {
                                                                    gymClass
                                                                        .activity
                                                                        .name
                                                                }
                                                            </strong>
                                                        </td>

                                                        <td>
                                                            {formatBuenosAires(
                                                                gymClass
                                                                    .startsAt,
                                                            )}

                                                            <span className="muted">
                                                                {' – '}

                                                                {formatBuenosAires(
                                                                    gymClass
                                                                        .endsAt,
                                                                )}
                                                            </span>
                                                        </td>

                                                        <td>
                                                            {
                                                                gymClass
                                                                    .professor
                                                                    .name
                                                            }
                                                        </td>

                                                        <td>
                                                            {user.role === 'MEMBER' && gymClass.availableSpots === 0 ? <strong>Sin cupos</strong> : <><strong>{gymClass.availableSpots}</strong>{' disponibles'}</>}
                                                            <span className="muted">{' · '}{gymClass.occupiedSpots} ocupados de {gymClass.capacity}</span>
                                                        </td>

                                                        <td>
                                                            <ClassStatusBadge
                                                                status={
                                                                    gymClass
                                                                        .status
                                                                }
                                                            />
                                                        </td>

                                                        <td>
                                                            <div className="row-actions">
                                                                <Link
                                                                    className="text-link"
                                                                    to={
                                                                        `${basePath}/${gymClass.id}`
                                                                    }
                                                                >
                                                                    Ver

                                                                    <span className="sr-only">
                                                                        {' '}

                                                                        {
                                                                            gymClass
                                                                                .activity
                                                                                .name
                                                                        }
                                                                    </span>
                                                                </Link>

                                                                {user.role === 'PROFESSOR' && gymClass.professor.id === user.id && <span className="badge active">Tu clase</span>}

                                                                {isAdmin &&
                                                                    gymClass.status ===
                                                                    'SCHEDULED' && (
                                                                        <>
                                                                            <Link
                                                                                className="text-link"
                                                                                to={
                                                                                    `${basePath}/${gymClass.id}/editar`
                                                                                }
                                                                            >
                                                                                Editar

                                                                                <span className="sr-only">
                                                                                    {' '}

                                                                                    {
                                                                                        gymClass
                                                                                            .activity
                                                                                            .name
                                                                                    }
                                                                                </span>
                                                                            </Link>

                                                                            <Button
                                                                                variant="ghost"
                                                                                aria-label={`Cancelar clase ${gymClass.activity.name}`}
                                                                                disabled={
                                                                                    busy ||
                                                                                    result.loading
                                                                                }
                                                                                onClick={() =>
                                                                                    setPending(
                                                                                        gymClass,
                                                                                    )
                                                                                }
                                                                            >
                                                                                Cancelar
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )
                            : !result.loading && (
                                <EmptyState title="No hay clases para mostrar">
                                    {isAdmin ? 'Cambiá los filtros o programá una nueva clase.' : 'Cambiá los filtros para consultar otras clases.'}
                                </EmptyState>
                            )
                    )}

                {viewMode === 'list' && result.data && (
                    <Pagination
                        page={page}
                        pageSize={10}
                        total={
                            result.data.meta.total
                        }
                        onChange={setPage}
                    />
                )}
            </section>

            {viewMode === 'calendar' && <ClassesCalendar
                weekStart={calendarWeekStart}
                classes={calendarClasses}
                loading={calendarLoading}
                error={calendarError}
                role={user.role}
                professorId={user.id}
                detailBasePath={basePath}
                onWeekStartChange={setCalendarWeekStart}
                onRetry={() => setCalendarRevision((value) => value + 1)}
            />}

            <ConfirmDialog
                open={Boolean(pending)}
                busy={busy}
                title="Cancelar clase"
                confirmLabel="Cancelar clase"
                onClose={() =>
                    setPending(null)
                }
                onConfirm={
                    confirmCancellation
                }
            >
                {pending && (
                    <p>
                        Se cancelará{' '}
                        {pending.activity.name}
                        {' del '}

                        {formatBuenosAires(
                            pending.startsAt,
                        )}.

                        {' '}Las inscripciones
                        activas se cancelarán y sus
                        créditos serán reintegrados.
                    </p>
                )}
            </ConfirmDialog>
        </>
    );
}
