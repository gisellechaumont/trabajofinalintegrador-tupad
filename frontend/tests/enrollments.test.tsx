import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AppRoutes } from '../src/app/App';
import { SessionProvider } from '../src/app/providers/SessionProvider';
import { formatBuenosAires } from '../src/features/classes/classes.dates';
import type { EnrollmentRecord } from '../src/features/enrollments/enrollments.types';

const admin = { id: 1, name: 'Admin Inscripciones', email: 'admin@enrollments.test', role: 'ADMIN' as const, active: true };
const member = { id: 12, name: 'Socio Inscripciones', email: 'member@enrollments.test', role: 'MEMBER' as const, active: true };
const professor = { id: 8, name: 'Profesor Inscripciones', email: 'professor@enrollments.test', role: 'PROFESSOR' as const, active: true };
const activity = { id: 3, name: 'Yoga' };
const gymClass = { id: 42, activity, professor: { id: professor.id, name: professor.name }, startsAt: '2030-02-03T15:00:00.000Z', endsAt: '2030-02-03T16:00:00.000Z', capacity: 10, occupiedSpots: 1, availableSpots: 9, cancelled: false, status: 'SCHEDULED' };
const packageInfo = { id: 51, packageType: { id: 6, name: 'Plan mensual' }, startsOn: '2030-02-01', expiresOn: '2030-03-02', initialCredits: 8, remainingCredits: 4, assignedAt: '2030-02-01T12:00:00.000Z' };
const eligibility = {
  canEnroll: true,
  reasonCode: null,
  message: 'El socio puede inscribirse.',
  selectedPackage: { ...packageInfo, member: { id: member.id, name: member.name } },
  expectedRemainingCredits: 3,
};
const enrollment: EnrollmentRecord = {
  id: 71, memberId: member.id, classId: gymClass.id, memberPackageId: packageInfo.id, cancelled: false,
  cancelledAt: null, creditRefunded: false, attendanceStatus: 'PENDING', attendanceRecordedBy: null,
  attendanceRecordedAt: null, createdAt: '2030-02-01T12:00:00.000Z', member: { id: member.id, name: member.name },
  memberPackage: { packageType: packageInfo.packageType, remainingCredits: packageInfo.remainingCredits },
  class: { startsAt: gymClass.startsAt, endsAt: gymClass.endsAt, cancelled: false, activity, professor: gymClass.professor },
};

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = <T,>(data: T[], pageNumber = 1, pageSize = 10, total = data.length) => ({ data, meta: { page: pageNumber, pageSize, total } });
type Role = typeof admin | typeof member | typeof professor;
interface MockOptions {
  eligibility?: (url: URL) => Response | Promise<Response>;
  enrollments?: (url: URL, init?: RequestInit) => Response | Promise<Response>;
  users?: (url: URL) => Response | Promise<Response>;
  classes?: (url: URL) => Response | Promise<Response>;
}

function installFetch(role: Role, options: MockOptions = {}) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); const path = url.pathname; const method = init?.method ?? 'GET';
    if (path.endsWith('/auth/login')) return response({ data: { accessToken: 'enrollment-test-token', tokenType: 'Bearer', expiresIn: 3600, user: role } });
    if (path.endsWith('/eligibility')) return options.eligibility?.(url) ?? response({ data: eligibility });
    if (path.endsWith('/enrollments') || /\/enrollments\/\d+(?:\/cancel)?$/.test(path)) {
      if (options.enrollments) return options.enrollments(url, init);
      if (method === 'POST' && path.endsWith('/cancel')) return response({ data: { ...enrollment, cancelled: true, cancelledAt: '2030-02-03T12:00:00.000Z', creditRefunded: true, memberPackage: { ...enrollment.memberPackage, remainingCredits: enrollment.memberPackage.remainingCredits + 1 } } });
      if (method === 'POST') return response({ data: enrollment }, 201);
      if (/\/enrollments\/\d+$/.test(path)) return response({ data: enrollment });
      return response(page([enrollment]));
    }
    if (path.endsWith('/users')) return options.users?.(url) ?? response(page([member]));
    if (path.endsWith('/classes') && method === 'GET') return options.classes?.(url) ?? response(page([gymClass]));
    if (/\/classes\/\d+$/.test(path)) return response({ data: gymClass });
    return response({ error: { code: 'NOT_FOUND', message: 'No se encontró el recurso.', fields: {} } }, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

function RouteProbe({ path }: { path: string }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(path)}>Abrir ruta de prueba</button>;
}

async function enterAs(role: Role, path = '/login', probePath = '/') {
  const user = userEvent.setup();
  render(<SessionProvider><MemoryRouter initialEntries={['/login']}><AppRoutes /><RouteProbe path={path === '/login' ? probePath : path} /></MemoryRouter></SessionProvider>);
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  await user.type(screen.getByLabelText('Correo electrónico'), role.email);
  await user.type(screen.getByLabelText('Contraseña'), 'clave-ficticia-de-prueba');
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('heading', { name: `Hola, ${role.name.split(' ')[0]}` });
  if (path !== '/login') await user.click(screen.getByRole('button', { name: 'Abrir ruta de prueba' }));
  return user;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('frontend de inscripciones HU-24 a HU-26', () => {
  it('muestra navegación administrativa de inscripciones', async () => {
    installFetch(admin); await enterAs(admin);
    expect(screen.getByRole('link', { name: 'Inscripciones' })).toHaveAttribute('href', '/admin/inscripciones');
  });

  it('muestra Mis inscripciones y bloquea una ruta administrativa al MEMBER', async () => {
    installFetch(member); const user = await enterAs(member, '/login', '/admin/inscripciones');
    expect(screen.getByRole('link', { name: 'Mis inscripciones' })).toHaveAttribute('href', '/socio/inscripciones');
    expect(screen.queryByRole('link', { name: 'Inscripciones' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir ruta de prueba' }));
    expect(await screen.findByRole('heading', { name: 'Esta sección no está habilitada para tu rol' })).toBeInTheDocument();
  });

  it('no muestra navegación ni permite rutas de inscripciones a PROFESSOR', async () => {
    installFetch(professor); const professorUser = await enterAs(professor, '/login', '/admin/inscripciones');
    expect(screen.queryByRole('link', { name: /inscripciones/i })).not.toBeInTheDocument();
    await professorUser.click(screen.getByRole('button', { name: 'Abrir ruta de prueba' }));
    expect(await screen.findByRole('heading', { name: 'Esta sección no está habilitada para tu rol' })).toBeInTheDocument();
  });

  it('consulta elegibilidad del socio sin mutar y presenta paquete y saldos', async () => {
    const fetcher = installFetch(member); await enterAs(member, '/socio/clases/42');
    expect(await screen.findByText('El socio puede inscribirse.')).toBeInTheDocument();
    expect(screen.getByText('Plan mensual')).toBeInTheDocument();
    expect(screen.getByText('Saldo actual').parentElement).toHaveTextContent('4');
    expect(screen.getByText('Saldo después de inscribirte').parentElement).toHaveTextContent('3');
    await waitFor(() => expect(fetcher.mock.calls.some(([input, init]) => new URL(String(input)).pathname.endsWith('/classes/42/eligibility') && (init?.method ?? 'GET') === 'GET')).toBe(true));
    const eligibilityRequest = fetcher.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith('/classes/42/eligibility'));
    expect(new URL(String(eligibilityRequest?.[0])).searchParams.has('memberId')).toBe(false);
    expect(fetcher.mock.calls.some(([input, init]) => new URL(String(input)).pathname.endsWith('/enrollments') && init?.method === 'POST')).toBe(false);
  });

  it('profesor consulta detalle básico sin pedir elegibilidad ni mostrar acciones de inscripción', async () => {
    const fetcher = installFetch(professor); await enterAs(professor, '/profesor/clases/42');
    expect(await screen.findByRole('heading', { level: 1, name: 'Yoga' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Inscribir socio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar clase' })).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).pathname.endsWith('/eligibility'))).toBe(false);
    expect(fetcher.mock.calls.some(([input, init]) => new URL(String(input)).pathname.endsWith('/enrollments') && init?.method === 'POST')).toBe(false);
  });

  it('normaliza la respuesta de elegibilidad canónica', async () => {
    installFetch(member, { eligibility: () => response({ data: {
      canEnroll: true, message: 'El socio puede inscribirse.', reasonCode: null,
      selectedPackage: { ...packageInfo, member: { id: member.id, name: member.name } }, expectedRemainingCredits: 3,
    } }) });
    await enterAs(member, '/socio/clases/42');
    expect(await screen.findByText('Plan mensual')).toBeInTheDocument();
    expect(screen.getByText('Saldo después de inscribirte').parentElement).toHaveTextContent('3');
  });

  it('confirma la inscripción MEMBER, bloquea doble envío y envía solo classId', async () => {
    let release!: (value: Response) => void;
    const fetcher = installFetch(member, { enrollments: (url, init) => {
      if (url.pathname.endsWith('/enrollments') && init?.method === 'POST') return new Promise<Response>((resolve) => { release = resolve; });
      return response(page([enrollment]));
    } });
    const user = await enterAs(member, '/socio/clases/42');
    await user.click(await screen.findByRole('button', { name: 'Inscribirme' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('El servidor volverá a comprobar');
    expect(fetcher.mock.calls.filter(([input, init]) => new URL(String(input)).pathname.endsWith('/enrollments') && init?.method === 'POST')).toHaveLength(0);
    const confirm = screen.getByRole('button', { name: 'Confirmar inscripción' });
    await user.click(confirm); await waitFor(() => expect(confirm).toBeDisabled());
    await user.click(confirm);
    const requests = fetcher.mock.calls.filter(([input, init]) => new URL(String(input)).pathname.endsWith('/enrollments') && init?.method === 'POST');
    expect(requests).toHaveLength(1);
    expect(JSON.parse(String(requests[0][1]?.body))).toEqual({ classId: 42 });
    release(response({ data: enrollment }, 201));
    expect(await screen.findByText(/Inscripción confirmada/)).toBeInTheDocument();
  });

  it.each([
    ['CLASS_FULL', 'La clase no tiene cupos disponibles.'],
    ['ALREADY_ENROLLED', 'El socio ya tiene una inscripción activa para esta clase.'],
    ['NO_USABLE_PACKAGE', 'El socio no tiene un paquete utilizable para esta clase.'],
  ])('muestra elegibilidad negativa %s sin acción de inscripción', async (reason, message) => {
    installFetch(member, { eligibility: () => response({ data: { canEnroll: false, reasonCode: reason, message, selectedPackage: null, expectedRemainingCredits: null } }) });
    await enterAs(member, '/socio/clases/42');
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument();
  });

  it('muestra el error real del POST aunque la elegibilidad previa fuera positiva', async () => {
    installFetch(member, { enrollments: (url, init) => url.pathname.endsWith('/enrollments') && init?.method === 'POST'
      ? response({ error: { code: 'CLASS_FULL', message: 'La clase se completó antes de confirmar.', fields: {} } }, 409)
      : response(page([enrollment])) });
    const user = await enterAs(member, '/socio/clases/42');
    await user.click(await screen.findByRole('button', { name: 'Inscribirme' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar inscripción' }));
    expect(await screen.findByText('La clase se completó antes de confirmar.')).toBeInTheDocument();
  });

  it('enlaza desde el detalle ADMIN al alta con classId preseleccionado', async () => {
    installFetch(admin); await enterAs(admin, '/admin/clases/42');
    expect(await screen.findByRole('link', { name: 'Inscribir socio' })).toHaveAttribute('href', '/admin/inscripciones/nueva?classId=42');
  });

  it('carga catálogos paginados, deduplica y crea con payload ADMIN exacto', async () => {
    const duplicateMember = { ...member, id: 24, name: 'Socia Seleccionada' };
    const anotherClass = { ...gymClass, id: 43, activity: { id: 4, name: 'Pilates' } };
    const fetcher = installFetch(admin, {
      users: (url) => response(page(url.searchParams.get('page') === '1' ? [duplicateMember] : [duplicateMember], Number(url.searchParams.get('page')), 1, 2)),
      classes: (url) => response(page(url.searchParams.get('page') === '1' ? [gymClass] : [gymClass, anotherClass], Number(url.searchParams.get('page')), 1, 2)),
    });
    const user = await enterAs(admin, '/admin/inscripciones/nueva?classId=43');
    const memberSelect = await screen.findByLabelText('Socio activo');
    expect(within(memberSelect).getAllByRole('option', { name: 'Socia Seleccionada' })).toHaveLength(1);
    const classSelect = screen.getByLabelText('Clase programada');
    expect((classSelect as HTMLSelectElement).value).toBe('43');
    expect(within(classSelect).getAllByRole('option', { name: /Yoga/ })).toHaveLength(1);
    expect(within(classSelect).getAllByRole('option', { name: /Pilates/ })).toHaveLength(1);
    expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).pathname.endsWith('/users') && new URL(String(input)).searchParams.get('page') === '2')).toBe(true);
    expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).pathname.endsWith('/classes') && new URL(String(input)).searchParams.get('page') === '2')).toBe(true);
    await user.selectOptions(memberSelect, '24');
    await screen.findByText('Puede inscribirse');
    expect(fetcher.mock.calls.some(([input]) => {
      const url = new URL(String(input));
      return url.pathname.endsWith('/classes/43/eligibility') && url.searchParams.get('memberId') === '24';
    })).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Crear inscripción' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([input, init]) => new URL(String(input)).pathname.endsWith('/enrollments') && init?.method === 'POST')).toBe(true));
    const request = fetcher.mock.calls.find(([input, init]) => new URL(String(input)).pathname.endsWith('/enrollments') && init?.method === 'POST');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ classId: 43, memberId: 24 });
  });

  it('muestra errores de validación del formulario asociados a la selección', async () => {
    const fetcher = installFetch(admin); const user = await enterAs(admin, '/admin/inscripciones/nueva');
    const memberSelect = await screen.findByLabelText('Socio activo');
    const classSelect = screen.getByLabelText('Clase programada');
    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }));
    expect(await screen.findByText('Seleccioná un socio y una clase.')).toBeInTheDocument();
    expect(screen.getByText('Seleccioná un socio activo.')).toBeInTheDocument();
    expect(screen.getByText('Seleccioná una clase.')).toBeInTheDocument();
    expect(memberSelect).toHaveAttribute('aria-invalid', 'true');
    expect(memberSelect).toHaveAttribute('aria-describedby', 'member-error');
    expect(classSelect).toHaveAttribute('aria-invalid', 'true');
    expect(classSelect).toHaveAttribute('aria-describedby', 'class-error');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input, init]) => {
      const url = new URL(String(input));
      return url.pathname.endsWith('/api/v1/enrollments') && init?.method === 'POST';
    })).toBe(false);
  });

  it('lista y filtra inscripciones ADMIN con fechas civiles convertidas a límites argentinos', async () => {
    const fetcher = installFetch(admin); const user = await enterAs(admin, '/admin/inscripciones');
    await screen.findByRole('table', { name: 'Inscripciones' });
    await user.selectOptions(screen.getByLabelText('Socio'), String(member.id));
    await user.selectOptions(screen.getByLabelText('Clase'), '42');
    await user.selectOptions(screen.getByLabelText('Estado de inscripción'), 'false');
    fireEvent.change(screen.getByLabelText('Desde (inclusive)'), { target: { value: '2030-02-01' } });
    fireEvent.change(screen.getByLabelText('Hasta (exclusivo)'), { target: { value: '2030-02-04' } });
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => {
      const url = new URL(String(input));
      return url.pathname.endsWith('/enrollments') && url.searchParams.get('memberId') === String(member.id)
        && url.searchParams.get('classId') === '42' && url.searchParams.get('cancelled') === 'false'
        && url.searchParams.get('from') === '2030-02-01T03:00:00.000Z' && url.searchParams.get('to') === '2030-02-04T03:00:00.000Z';
    })).toBe(true));
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('permite paginar el listado administrativo', async () => {
    const fetcher = installFetch(admin, { enrollments: (url) => response(page([enrollment], Number(url.searchParams.get('page')), 10, 11)) });
    const user = await enterAs(admin, '/admin/inscripciones');
    await screen.findByRole('table', { name: 'Inscripciones' });
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => {
      const url = new URL(String(input)); return url.pathname.endsWith('/enrollments') && url.searchParams.get('page') === '2';
    })).toBe(true));
  });

  it.each([
    ['upcoming', 'false', 'from'], ['past', 'false', 'to'], ['cancelled', 'true', null], ['all', null, null],
  ] as const)('traduce la vista MEMBER %s sin enviar memberId', async (view, cancelledValue, timeFilter) => {
    const fetcher = installFetch(member); const user = await enterAs(member, '/socio/inscripciones');
    await screen.findByRole('table', { name: 'Mis inscripciones' });
    await user.selectOptions(screen.getByLabelText('Mostrar'), view);
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => {
      const url = new URL(String(input));
      return url.pathname.endsWith('/enrollments') && url.searchParams.get('cancelled') === cancelledValue
        && (timeFilter ? Boolean(url.searchParams.get(timeFilter)) : !url.searchParams.has('from') && !url.searchParams.has('to'));
    })).toBe(true));
    const listCalls = fetcher.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/enrollments'));
    expect(listCalls.every(([input]) => !new URL(String(input)).searchParams.has('memberId'))).toBe(true);
  });

  it('muestra detalle propio y cancela solo después de confirmar', async () => {
    const fetcher = installFetch(member); const user = await enterAs(member, '/socio/inscripciones/71');
    expect(await screen.findByRole('heading', { name: 'Inscripción #71' })).toBeInTheDocument();
    expect(screen.getByText('Plan mensual (#51)')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar inscripción de Socio Inscripciones para Yoga' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input, init]) => new URL(String(input)).pathname.endsWith('/cancel') && init?.method === 'POST')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    await screen.findByText('Inscripción cancelada. Se reintegró el crédito al paquete utilizado.');
    const cancelRequest = fetcher.mock.calls.find(([input, init]) => new URL(String(input)).pathname.endsWith('/enrollments/71/cancel') && init?.method === 'POST');
    expect(cancelRequest?.[1]?.body).toBeUndefined();
  });

  it('no muestra datos del detalle ajeno cuando el backend responde 403', async () => {
    installFetch(member, { enrollments: (url) => url.pathname.endsWith('/enrollments/72')
      ? response({ error: { code: 'FORBIDDEN', message: 'No tenés permisos para consultar esta inscripción.', fields: {} } }, 403)
      : response({ data: enrollment }) });
    await enterAs(member, '/socio/inscripciones/72');
    expect(await screen.findByText('No tenés permisos para consultar esta inscripción.')).toBeInTheDocument();
    expect(screen.queryByText('Inscripción #72')).not.toBeInTheDocument();
  });

  it('muestra el error de acceso al detalle ajeno sin exponer sus datos', async () => {
    installFetch(member, { enrollments: (url) => url.pathname.endsWith('/enrollments/72')
      ? response({ error: { code: 'FORBIDDEN', message: 'No tenés permisos para consultar esta inscripción.', fields: {} } }, 403)
      : response({ data: enrollment }) });
    await enterAs(member, '/socio/inscripciones/72');
    expect(await screen.findByText('No tenés permisos para consultar esta inscripción.')).toBeInTheDocument();
    expect(screen.queryByText('Inscripción #72')).not.toBeInTheDocument();
  });

  it('muestra claramente CANCELLATION_WINDOW_CLOSED', async () => {
    installFetch(member, { enrollments: (url, init) => url.pathname.endsWith('/cancel') && init?.method === 'POST'
      ? response({ error: { code: 'CANCELLATION_WINDOW_CLOSED', message: 'La ventana de cancelación está cerrada.', fields: {} } }, 409)
      : response({ data: enrollment }) });
    const user = await enterAs(member, '/socio/inscripciones/71');
    await screen.findByRole('heading', { name: 'Inscripción #71' });
    await user.click(screen.getByRole('button', { name: /Cancelar inscripción de/ }));
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(await screen.findByText(/CANCELLATION_WINDOW_CLOSED: La ventana de cancelación está cerrada/)).toBeInTheDocument();
  });

  it('formatea el inicio del detalle en la zona horaria de Buenos Aires', async () => {
    installFetch(member); await enterAs(member, '/socio/inscripciones/71');
    await screen.findByRole('heading', { name: 'Inscripción #71' });
    expect(screen.getByText(formatBuenosAires(gymClass.startsAt))).toBeInTheDocument();
  });

  it('muestra estado vacío, error y reintento en el listado', async () => {
    let failed = true;
    installFetch(member, { enrollments: () => {
      if (failed) return response({ error: { code: 'HTTP_ERROR', message: 'No se pudieron cargar las inscripciones.', fields: {} } }, 500);
      return response(page([]));
    } });
    const user = await enterAs(member, '/socio/inscripciones');
    expect(await screen.findByText('No se pudieron cargar las inscripciones.')).toBeInTheDocument();
    failed = false; await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No tenés próximas inscripciones activas.')).toBeInTheDocument();
  });

  it('muestra el estado de éxito y la ausencia de acciones para inscripciones canceladas', async () => {
    installFetch(member, { enrollments: (url) => response({ data: { ...enrollment, cancelled: true, cancelledAt: '2030-02-02T12:00:00.000Z', memberPackage: { ...enrollment.memberPackage, remainingCredits: enrollment.memberPackage.remainingCredits + 1 } } }) });
    await enterAs(member, '/socio/inscripciones/71');
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar inscripción/ })).not.toBeInTheDocument();
  });
});
