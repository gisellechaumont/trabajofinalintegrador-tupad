import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/app/App';
import { SessionProvider } from '../src/app/providers/SessionProvider';
import { buenosAiresInputToIso, formatBuenosAires, isoToBuenosAiresInput } from '../src/features/classes/classes.dates';

const activity = { id: 3, name: 'Yoga', active: true, description: null };
const professor = { id: 8, name: 'Ana Profesora', email: 'ana@test.local', role: 'PROFESSOR', active: true };
const admin = { id: 1, name: 'Admin Demo', email: 'admin@test.local', role: 'ADMIN', active: true };
const member = { id: 12, name: 'Socio Demo', email: 'socio@test.local', role: 'MEMBER', active: true };
const scheduled = { id: 42, activity: { id: activity.id, name: activity.name }, professor: { id: professor.id, name: professor.name }, startsAt: '2030-02-03T15:00:00.000Z', endsAt: '2030-02-03T16:00:00.000Z', capacity: 2, occupiedSpots: 2, availableSpots: 0, cancelled: false, status: 'SCHEDULED' };
const cancelled = { ...scheduled, id: 43, cancelled: true, status: 'CANCELLED' };
const weekClass = { ...scheduled, id: 77, startsAt: '2030-02-05T02:30:00.000Z', endsAt: '2030-02-05T03:30:00.000Z' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.useRealTimers());

function freezeWeekDate() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2030-02-06T15:00:00.000Z'));
}

function mockFetch(role: typeof admin | typeof member | typeof professor, options: { classes?: unknown[]; activities?: unknown[]; professors?: unknown[]; batchConflict?: boolean } = {}) {
  const rows = options.classes ?? [scheduled];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); const path = url.pathname;
    if (path.endsWith('/auth/login')) return response({ data: { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 3600, user: role } });
    if (path.endsWith('/activities')) {
      const data = options.activities ?? [activity];
      return response({ data, meta: { page: Number(url.searchParams.get('page') ?? 1), pageSize: Number(url.searchParams.get('pageSize') ?? 100), total: data.length } });
    }
    if (path.endsWith('/users')) {
      const data = options.professors ?? [professor];
      return response({ data, meta: { page: Number(url.searchParams.get('page') ?? 1), pageSize: Number(url.searchParams.get('pageSize') ?? 100), total: data.length } });
    }
    if (path.endsWith('/classes/batch') && init?.method === 'POST') {
      if (options.batchConflict) return response({ error: { code: 'CLASS_SCHEDULE_CONFLICT', message: 'Una de las clases ya existe para esa actividad, profesor y horario de inicio. No se creó ninguna clase del lote.', fields: {} } }, 409);
      const startsAt = ['2030-02-04T15:00:00.000Z', '2030-02-06T15:00:00.000Z', '2030-02-11T15:00:00.000Z', '2030-02-13T15:00:00.000Z', '2030-02-18T15:00:00.000Z'];
      return response({ data: startsAt.map((start, index) => ({ ...scheduled, id: 100 + index, startsAt: start, endsAt: new Date(Date.parse(start) + 3_600_000).toISOString() })) }, 201);
    }
    if (path.endsWith('/classes') && init?.method === 'POST') return response({ data: { ...scheduled, id: 45 } }, 201);
    if (/\/classes\/\d+$/.test(path) && init?.method === 'PATCH') return response({ data: rows.find((row) => (row as typeof scheduled).id === Number(path.split('/').pop())) ?? scheduled });
    if (path.endsWith('/classes/42/cancel')) return response({ data: { class: { ...scheduled, status: 'CANCELLED', cancelled: true }, cancelledEnrollments: 0, refundedCredits: 0 } });
    if (/\/classes\/\d+$/.test(path)) {
      const classId = Number(path.split('/').pop());
      return response({ data: rows.find((row) => (row as typeof scheduled).id === classId) ?? { ...scheduled, id: classId } });
    }
    if (path.endsWith('/classes')) {
      let filtered = rows as Array<typeof scheduled>;
      const professorId = url.searchParams.get('professorId'); const activityId = url.searchParams.get('activityId');
      const from = url.searchParams.get('from'); const to = url.searchParams.get('to'); const status = url.searchParams.get('status');
      if (professorId) filtered = filtered.filter((row) => row.professor.id === Number(professorId));
      if (activityId) filtered = filtered.filter((row) => row.activity.id === Number(activityId));
      if (from) filtered = filtered.filter((row) => Date.parse(row.startsAt) >= Date.parse(from));
      if (to) filtered = filtered.filter((row) => Date.parse(row.startsAt) < Date.parse(to));
      if (status) filtered = filtered.filter((row) => row.status === status);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 10); const page = Number(url.searchParams.get('page') ?? 1);
      const data = filtered.slice((page - 1) * pageSize, page * pageSize);
      return response({ data, meta: { page, pageSize, total: filtered.length } });
    }
    return response({ data: [], meta: { page: 1, pageSize: 10, total: 0 } });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

async function enterAs(role: typeof admin | typeof member | typeof professor) {
  const user = userEvent.setup();
  render(<SessionProvider><MemoryRouter initialEntries={['/login']}><AppRoutes /></MemoryRouter></SessionProvider>);
  await user.type(screen.getByLabelText('Correo electrónico'), role.email);
  await user.type(screen.getByLabelText('Contraseña'), 'clave-ficticia-de-prueba');
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('heading', { name: `Hola, ${role.name.split(' ')[0]}` });
  await user.click(screen.getByRole('link', { name: 'Clases' }));
  return user;
}

describe('interfaz de Clases', () => {
  it('muestra ocupación, cupos y marca las clases llenas para MEMBER sin ofrecer canceladas', async () => {
    const fetcher = mockFetch(member, { classes: [scheduled, cancelled] });
    await enterAs(member);
    expect(await screen.findByText('Sin cupos')).toBeInTheDocument();
    expect(screen.getByText(/2 ocupados de 2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Programar clase|Editar/ })).not.toBeInTheDocument();
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('status') === 'SCHEDULED')).toBe(true));
  });

  it('permite a PROFESSOR alternar agenda y clases propias y marca Tu clase', async () => {
    const fetcher = mockFetch(professor);
    const user = await enterAs(professor);
    expect(await screen.findByText('Tu clase')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agenda general' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Profesor'), String(professor.id));
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('professorId') === String(professor.id))).toBe(true));
    await user.selectOptions(screen.getByLabelText('Actividad'), String(activity.id));
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('activityId') === String(activity.id))).toBe(true));
    await user.click(screen.getByLabelText('Solo mis clases'));
    expect(await screen.findByRole('heading', { name: 'Mis clases' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument();
  });

  it('permite alta ADMIN y envía instantes ISO/UTC', async () => {
    const fetcher = mockFetch(admin);
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: '+ Programar clase' }));
    await screen.findByRole('heading', { name: 'Programar clase' });
    await user.selectOptions(screen.getByLabelText('Actividad'), String(activity.id));
    await user.selectOptions(screen.getByLabelText('Profesor'), String(professor.id));
    await user.type(screen.getByLabelText('Fecha y hora de inicio'), '2030-02-03T12:00');
    await user.type(screen.getByLabelText('Fecha y hora de finalización'), '2030-02-03T13:00');
    await user.clear(screen.getByLabelText('Capacidad')); await user.type(screen.getByLabelText('Capacidad'), '10');
    await user.click(screen.getByRole('button', { name: 'Programar clase' }));
    await screen.findByRole('heading', { name: 'Yoga' });
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST' && String(init.body).includes('capacity'));
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ startsAt: '2030-02-03T15:00:00.000Z', endsAt: '2030-02-03T16:00:00.000Z', capacity: 10 });
    expect(new URL(String(post?.[0])).pathname.endsWith('/classes')).toBe(true);
  });

  it('previsualiza y confirma un lote semanal en hora de Buenos Aires', async () => {
    freezeWeekDate();
    const fetcher = mockFetch(admin);
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: '+ Programar clase' }));
    await screen.findByRole('heading', { name: 'Programar clase' });
    await user.selectOptions(screen.getByLabelText('Repetición'), 'weekly');
    await user.selectOptions(screen.getByLabelText('Actividad'), String(activity.id));
    await user.selectOptions(screen.getByLabelText('Profesor'), String(professor.id));
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2030-02-04' } });
    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText('Hora de finalización'), { target: { value: '13:00' } });
    await user.type(screen.getByLabelText('Capacidad'), '10');
    await user.click(screen.getByLabelText('Lunes'));
    await user.click(screen.getByLabelText('Miércoles'));
    fireEvent.change(screen.getByLabelText('Repetir hasta (inclusive)'), { target: { value: '2030-02-18' } });

    expect(screen.getByText(/Se generarán 5 clases\. Primera fecha: lunes, 4 feb\. Última fecha: lunes, 18 feb\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar programación' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Se crearán 5 clases independientes');
    expect(fetcher.mock.calls.some(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname.endsWith('/classes/batch'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Crear 5 clases' }));
    expect(await screen.findByText('Se programaron 5 clases correctamente.')).toBeInTheDocument();

    const batchRequest = fetcher.mock.calls.find(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname.endsWith('/classes/batch'));
    expect(JSON.parse(String(batchRequest?.[1]?.body))).toEqual({
      activityId: activity.id,
      professorId: professor.id,
      startsAt: '2030-02-04T15:00:00.000Z',
      endsAt: '2030-02-04T16:00:00.000Z',
      capacity: 10,
      daysOfWeek: [1, 3],
      repeatUntil: '2030-02-18',
    });
  });

  it('muestra el conflicto del backend y no crea el lote sin confirmar', async () => {
    freezeWeekDate();
    const fetcher = mockFetch(admin, { batchConflict: true });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: '+ Programar clase' }));
    await screen.findByRole('heading', { name: 'Programar clase' });
    await user.selectOptions(screen.getByLabelText('Repetición'), 'weekly');
    await user.selectOptions(screen.getByLabelText('Actividad'), String(activity.id));
    await user.selectOptions(screen.getByLabelText('Profesor'), String(professor.id));
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2030-02-04' } });
    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText('Hora de finalización'), { target: { value: '13:00' } });
    await user.type(screen.getByLabelText('Capacidad'), '10');
    await user.click(screen.getByLabelText('Lunes'));
    fireEvent.change(screen.getByLabelText('Repetir hasta (inclusive)'), { target: { value: '2030-02-18' } });
    await user.click(screen.getByRole('button', { name: 'Revisar programación' }));
    await user.click(screen.getByRole('button', { name: 'Crear 3 clases' }));

    expect(await screen.findByText(/No se creó ninguna clase del lote/)).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname.endsWith('/classes/batch'))).toHaveLength(1);
  });

  it('edita con PATCH parcial y conserva actividad y profesor inactivos sin enviarlos', async () => {
    const inactive = { ...scheduled, activity: { id: 99, name: 'Actividad anterior' }, professor: { id: 98, name: 'Profesor anterior' } };
    const fetcher = mockFetch(admin, { classes: [inactive], activities: [], professors: [] });
    const user = await enterAs(admin);
    await screen.findByRole('link', { name: /Ver/ });
    await user.click(screen.getByRole('link', { name: /Editar/ }));
    await screen.findByRole('heading', { name: 'Editar clase' });
    expect(screen.queryByLabelText('Repetición')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Actividad anterior — inactivo — valor actual/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Profesor anterior — inactivo — valor actual/ })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Capacidad')); await user.type(screen.getByLabelText('Capacidad'), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
    const patch = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ capacity: 3 });
  });

  it('carga todas las páginas de catálogos para el formulario', async () => {
    const secondActivity = { ...activity, id: 104, name: 'Yoga avanzada' };
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/auth/login')) return response({ data: { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 3600, user: admin } });
      if (url.pathname.endsWith('/activities')) return response({ data: Number(url.searchParams.get('page')) === 1 ? [activity] : [secondActivity], meta: { page: Number(url.searchParams.get('page')), pageSize: 100, total: 101 } });
    if (url.pathname.endsWith('/users')) {
      const secondProfessor = { ...professor, id: 105, name: 'Bruno Profesor' };
      return response({ data: Number(url.searchParams.get('page')) === 1 ? [professor] : [secondProfessor], meta: { page: Number(url.searchParams.get('page')), pageSize: 100, total: 101 } });
    }
      if (init?.method === 'POST') return response({ data: scheduled }, 201);
      return response({ data: [], meta: { page: 1, pageSize: 10, total: 0 } });
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup(); render(<SessionProvider><MemoryRouter initialEntries={['/login']}><AppRoutes /></MemoryRouter></SessionProvider>);
    await user.type(screen.getByLabelText('Correo electrónico'), admin.email); await user.type(screen.getByLabelText('Contraseña'), 'clave-ficticia-de-prueba'); await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    await user.click(await screen.findByRole('link', { name: 'Clases' })); await user.click(await screen.findByRole('link', { name: '+ Programar clase' }));
    expect(await screen.findByRole('option', { name: 'Yoga avanzada' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Bruno Profesor' })).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('page') === '2')).toBe(true);
  });

  it('exige confirmación para cancelar desde el listado', async () => {
    const fetcher = mockFetch(admin); const user = await enterAs(admin);
    await user.click(await screen.findByRole('button', { name: 'Cancelar clase Yoga' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname.endsWith('/classes/42/cancel'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Cancelar clase' }));
    expect(await screen.findByText('Clase cancelada correctamente.')).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname.endsWith('/classes/42/cancel'))).toHaveLength(1);
  });

  it('muestra el detalle y requiere confirmar la cancelación iniciada allí', async () => {
    const fetcher = mockFetch(admin); const user = await enterAs(admin);
    await user.click(await screen.findByRole('link', { name: /Ver/ }));
    expect(await screen.findByText('2 inscripciones activas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar clase' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname.endsWith('/classes/42/cancel'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(await screen.findByText('Clase cancelada correctamente.')).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname.endsWith('/classes/42/cancel'))).toHaveLength(1);
  });

  it('presenta los errores del backend junto al campo correspondiente', async () => {
    const fetcher = mockFetch(admin);
    fetcher.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/login')) return response({ data: { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 3600, user: admin } });
      if (path.endsWith('/classes') && init?.method === 'POST') {
        return response({ error: { code: 'CLASS_MUST_BE_FUTURE', message: 'La clase debe comenzar en una fecha futura.', fields: { startsAt: 'Elegí una fecha y hora futura.' } } }, 422);
      }
      if (path.endsWith('/activities')) return response({ data: [activity], meta: { page: 1, pageSize: 100, total: 1 } });
      if (path.endsWith('/users')) return response({ data: [professor], meta: { page: 1, pageSize: 100, total: 1 } });
      return response({ data: [], meta: { page: 1, pageSize: 100, total: 0 } });
    });
    const user = await enterAs(admin); await user.click(screen.getByRole('link', { name: '+ Programar clase' }));
    await screen.findByRole('heading', { name: 'Programar clase' });
    await user.selectOptions(screen.getByLabelText('Actividad'), String(activity.id)); await user.selectOptions(screen.getByLabelText('Profesor'), String(professor.id));
    await user.type(screen.getByLabelText('Fecha y hora de inicio'), '2020-02-03T12:00'); await user.type(screen.getByLabelText('Fecha y hora de finalización'), '2020-02-03T13:00');
    await user.type(screen.getByLabelText('Capacidad'), '10'); await user.click(screen.getByRole('button', { name: 'Programar clase' }));
    expect(await screen.findByText('La clase debe comenzar en una fecha futura.')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha y hora de inicio')).toHaveAttribute('aria-invalid', 'true');
  });

  it('convierte y formatea instantes con la zona de Buenos Aires', () => {
    const iso = buenosAiresInputToIso('2030-02-03T12:00');
    expect(iso).toBe('2030-02-03T15:00:00.000Z');
    expect(isoToBuenosAiresInput(iso)).toBe('2030-02-03T12:00');
    expect(formatBuenosAires(iso)).toContain('12:00');
  });

  it('muestra siete días, agrupa por fecha argentina y abre el detalle de una clase', async () => {
    freezeWeekDate();
    mockFetch(admin, { classes: [weekClass] });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('button', { name: 'Ver calendario semanal' }));
    expect(await screen.findByRole('heading', { name: /Semana del lunes, 4 feb.*domingo, 10 feb/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    const monday = screen.getByRole('heading', { level: 3, name: /lunes, 4 feb/i }).closest('section');
    expect(monday).not.toBeNull();
    const classLink = within(monday as HTMLElement).getByRole('link', { name: /Clase Yoga/ });
    expect(classLink).toHaveAttribute('href', '/admin/clases/77');
    expect(classLink).toHaveTextContent('Programada');
    expect(classLink).toHaveTextContent('Sin cupos');
    await user.click(classLink);
    expect(await screen.findByRole('heading', { name: 'Yoga' })).toBeInTheDocument();
  });

  it('navega semanas, vuelve a la actual y conserva los filtros activos', async () => {
    freezeWeekDate();
    const fetcher = mockFetch(professor, { classes: [weekClass] });
    const user = await enterAs(professor);
    await user.selectOptions(screen.getByLabelText('Actividad'), String(activity.id));
    await user.selectOptions(screen.getByLabelText('Profesor'), String(professor.id));
    await user.selectOptions(screen.getByLabelText('Estado'), 'SCHEDULED');
    await user.click(screen.getByRole('button', { name: 'Ver calendario semanal' }));
    await screen.findByRole('heading', { level: 2, name: /^Semana del lunes, 4 feb/i });

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => {
      const url = new URL(String(input));
      return url.searchParams.get('from') === '2030-02-11T03:00:00.000Z' && url.searchParams.get('activityId') === String(activity.id) && url.searchParams.get('professorId') === String(professor.id) && url.searchParams.get('status') === 'SCHEDULED';
    })).toBe(true));
    expect(screen.getByLabelText('Solo mis clases')).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await user.click(screen.getByLabelText('Solo mis clases'));
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => {
      const url = new URL(String(input));
      return url.searchParams.get('from') === '2030-01-28T03:00:00.000Z' && url.searchParams.get('professorId') === String(professor.id) && url.searchParams.get('activityId') === String(activity.id) && url.searchParams.get('status') === 'SCHEDULED';
    })).toBe(true));
    expect(screen.getByLabelText('Solo mis clases')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Ir a la semana actual' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('from') === '2030-02-04T03:00:00.000Z')).toBe(true));
  });

  it('muestra un estado vacío para la semana y filtros seleccionados', async () => {
    freezeWeekDate();
    mockFetch(admin, { classes: [] });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('button', { name: 'Ver calendario semanal' }));
    expect(await screen.findByText('No encontramos clases que coincidan con los filtros seleccionados.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /No hay clases para la semana del lunes, 4 feb.*domingo, 10 feb/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
  });

  it('conserva los filtros Desde y Hasta del listado al alternar de vista', async () => {
    freezeWeekDate();
    mockFetch(admin);
    const user = await enterAs(admin);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2030-02-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2030-02-02' } });
    await user.click(screen.getByRole('button', { name: 'Ver calendario semanal' }));
    await screen.findByRole('heading', {
      level: 2,
      name: /^Semana del lunes, 4 feb/i,
    });
    await user.click(screen.getByRole('button', { name: 'Ver listado' }));
    expect(screen.getByLabelText('Desde')).toHaveValue('2030-02-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2030-02-02');
  });

  it('mantiene visible la clase llena para MEMBER sin agregar acciones operativas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-02-01T15:00:00.000Z'));
    mockFetch(member, { classes: [scheduled] });
    const user = await enterAs(member);
    await user.click(screen.getByRole('button', { name: 'Ver calendario semanal' }));
    const classLink = await screen.findByRole('link', { name: /Clase Yoga/ });
    expect(classLink).toHaveTextContent('Sin cupos');
    expect(classLink).toHaveTextContent('Programada');
    expect(screen.queryByRole('button', { name: /Inscribir|Asistencia|Cancelar clase/ })).not.toBeInTheDocument();
  });
});
