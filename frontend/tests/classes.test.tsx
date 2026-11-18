import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockFetch(role: typeof admin | typeof member | typeof professor, options: { classes?: unknown[]; activities?: unknown[]; professors?: unknown[] } = {}) {
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
    if (path.endsWith('/classes') && init?.method === 'POST') return response({ data: { ...scheduled, id: 45 } }, 201);
    if (/\/classes\/\d+$/.test(path) && init?.method === 'PATCH') return response({ data: rows.find((row) => (row as typeof scheduled).id === Number(path.split('/').pop())) ?? scheduled });
    if (path.endsWith('/classes/42/cancel')) return response({ data: { class: { ...scheduled, status: 'CANCELLED', cancelled: true }, cancelledEnrollments: 0, refundedCredits: 0 } });
    if (/\/classes\/\d+$/.test(path)) {
      const classId = Number(path.split('/').pop());
      return response({ data: rows.find((row) => (row as typeof scheduled).id === classId) ?? { ...scheduled, id: classId } });
    }
    if (path.endsWith('/classes')) {
      const filtered = url.searchParams.get('professorId') ? rows.filter((row) => (row as typeof scheduled).professor.id === Number(url.searchParams.get('professorId'))) : rows;
      const data = url.searchParams.get('status') === 'SCHEDULED' ? filtered.filter((row) => (row as typeof scheduled).status === 'SCHEDULED') : filtered;
      return response({ data, meta: { page: Number(url.searchParams.get('page') ?? 1), pageSize: 10, total: data.length } });
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
  });

  it('edita con PATCH parcial y conserva actividad y profesor inactivos sin enviarlos', async () => {
    const inactive = { ...scheduled, activity: { id: 99, name: 'Actividad anterior' }, professor: { id: 98, name: 'Profesor anterior' } };
    const fetcher = mockFetch(admin, { classes: [inactive], activities: [], professors: [] });
    const user = await enterAs(admin);
    await screen.findByRole('link', { name: /Ver/ });
    await user.click(screen.getByRole('link', { name: /Editar/ }));
    await screen.findByRole('heading', { name: 'Editar clase' });
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
});
