import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AppRoutes } from '../src/app/App';
import { SessionProvider } from '../src/app/providers/SessionProvider';
import { formatBuenosAiresInstant, formatCivilDate, isCivilDate } from '../src/features/packages/packages.dates';
import type { MemberPackage, PackageType } from '../src/features/packages/packages.types';

const admin = { id: 1, name: 'Admin Paquetes', email: 'admin@packages.test', role: 'ADMIN' as const, active: true };
const member = { id: 12, name: 'Socia Paquetes', email: 'member@packages.test', role: 'MEMBER' as const, active: true };
const activeMemberOther = { id: 14, name: 'Otro Socio Activo', email: 'active@packages.test', role: 'MEMBER' as const, active: true };
const inactiveMember = { id: 13, name: 'Socio Histórico', email: 'history@packages.test', role: 'MEMBER' as const, active: false };
const professor = { id: 8, name: 'Profesor Paquetes', email: 'professor@packages.test', role: 'PROFESSOR' as const, active: true };

const packageType: PackageType = { id: 3, name: 'Plan mensual', classCredits: 8, durationDays: 30, active: true };
const packageTypeOther: PackageType = { id: 4, name: 'Plan breve', classCredits: 4, durationDays: 7, active: true };
const archivedType: PackageType = { id: 5, name: 'Plan archivado', classCredits: 6, durationDays: 15, active: false };
const packageRow = (overrides: Partial<MemberPackage> = {}): MemberPackage => ({
  id: 41,
  member: { id: member.id, name: member.name },
  packageType: { id: packageType.id, name: packageType.name },
  startsOn: '2030-02-04',
  expiresOn: '2030-03-05',
  initialCredits: 8,
  remainingCredits: 5,
  assignedAt: '2030-02-04T15:00:00.000Z',
  status: 'ACTIVE',
  expiringSoon: false,
  ...overrides,
});

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = <T,>(data: T[], pageNumber = 1, pageSize = 10, total = data.length) => ({ data, meta: { page: pageNumber, pageSize, total } });

interface MockOptions {
  packageTypes?: (url: URL, init?: RequestInit) => Response | Promise<Response>;
  users?: (url: URL) => Response | Promise<Response>;
  memberPackages?: (url: URL, init?: RequestInit) => Response | Promise<Response>;
}

function installFetch(role: typeof admin | typeof member | typeof professor, options: MockOptions = {}) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const method = init?.method ?? 'GET';
    if (path.endsWith('/auth/login')) return response({ data: { accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600, user: role } });
    if (path.endsWith('/users')) return options.users?.(url) ?? response(page([member]));
    if (path.endsWith('/package-types') || /\/package-types\/\d+$/.test(path)) {
      if (options.packageTypes) return options.packageTypes(url, init);
      if (method === 'POST') return response({ data: { ...packageType, id: 5, name: 'Nuevo plan' } }, 201);
      if (method === 'PATCH') return response({ data: packageType });
      if (/\/package-types\/\d+$/.test(path)) return response({ data: packageType });
      return response(page([packageType]));
    }
    if (path.endsWith('/member-packages') || /\/member-packages\/\d+$/.test(path)) {
      if (options.memberPackages) return options.memberPackages(url, init);
      if (method === 'POST') return response({ data: packageRow({ id: 42 }) }, 201);
      if (/\/member-packages\/\d+$/.test(path)) return response({ data: packageRow({ id: Number(path.split('/').pop()) }) });
      return response(page([packageRow()]));
    }
    return response(page([]));
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

function RouteProbe({ path }: { path: string }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(path)}>Abrir ruta de prueba</button>;
}

async function enterAs(role: typeof admin | typeof member | typeof professor, path = '/login', probePath = '/') {
  const user = userEvent.setup();
  render(<SessionProvider><MemoryRouter initialEntries={[path]}><AppRoutes /><RouteProbe path={probePath} /></MemoryRouter></SessionProvider>);
  if (path === '/login') {
    await user.type(screen.getByLabelText('Correo electrónico'), role.email);
    await user.type(screen.getByLabelText('Contraseña'), 'clave-ficticia-de-prueba');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
  } else {
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await user.type(screen.getByLabelText('Correo electrónico'), role.email);
    await user.type(screen.getByLabelText('Contraseña'), 'clave-ficticia-de-prueba');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
  }
  await screen.findByRole('heading', { name: `Hola, ${role.name.split(' ')[0]}` });
  return user;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('frontend de paquetes', () => {
  it('muestra navegación administrativa y permite sus rutas', async () => {
    installFetch(admin);
    const adminUser = await enterAs(admin, '/login', '/admin/tipos-paquete');
    expect(screen.getByRole('link', { name: 'Tipos de paquete' })).toHaveAttribute('href', '/admin/tipos-paquete');
    expect(screen.getByRole('link', { name: 'Paquetes' })).toHaveAttribute('href', '/admin/paquetes');
    await adminUser.click(screen.getByRole('button', { name: 'Abrir ruta de prueba' }));
    expect(await screen.findByRole('heading', { name: 'Tipos de paquete' })).toBeInTheDocument();

  });

  it('muestra Mis paquetes al socio y bloquea una ruta administrativa', async () => {
    installFetch(member);
    const memberUser = await enterAs(member, '/login', '/admin/tipos-paquete');
    expect(screen.getByRole('link', { name: 'Mis paquetes' })).toHaveAttribute('href', '/socio/paquetes');
    expect(screen.queryByRole('link', { name: 'Tipos de paquete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Paquetes' })).not.toBeInTheDocument();
    await memberUser.click(screen.getByRole('button', { name: 'Abrir ruta de prueba' }));
    expect(await screen.findByRole('heading', { name: 'Esta sección no está habilitada para tu rol' })).toBeInTheDocument();
  });

  it('profesor no recibe navegación ni acceso a rutas de paquetes', async () => {
    installFetch(professor);
    const user = await enterAs(professor, '/login', '/admin/paquetes');
    expect(screen.queryByRole('link', { name: /paquetes/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir ruta de prueba' }));
    expect(await screen.findByRole('heading', { name: 'Esta sección no está habilitada para tu rol' })).toBeInTheDocument();
  });

  it('lista tipos con búsqueda, estado y paginación, y confirma cambios de estado sin ofrecer eliminación', async () => {
    const fetcher = installFetch(admin, { packageTypes: (url, init) => {
      if (init?.method === 'PATCH') return response({ data: { ...packageTypeOther, active: true } });
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      const filtered = url.searchParams.get('active') === 'false';
      return response(page(pageNumber === 1 ? [filtered ? archivedType : packageType] : [{ ...packageTypeOther, active: false }], pageNumber, 10, 11));
    } });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Tipos de paquete' }));
    const row = await screen.findByRole('row', { name: /Plan mensual/ });
    within(row).getByText('Plan mensual', { selector: 'strong' });
    await user.type(screen.getByLabelText('Buscar tipo de paquete'), 'Plan');
    await user.selectOptions(screen.getByLabelText('Estado'), 'false');
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => String(input).includes('search=Plan') && String(input).includes('active=false'))).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    const briefPlanRow = await screen.findByRole('row', { name: /Plan breve/ });
    within(briefPlanRow).getByText('Plan breve', { selector: 'strong' });
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('page=2'))).toBe(true);
    expect(screen.queryByRole('button', { name: /eliminar|borrar/i })).not.toBeInTheDocument();

    await user.click(within(briefPlanRow).getByRole('button', { name: 'Activar tipo de paquete Plan breve' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Plan breve volverá a estar disponible para nuevas asignaciones.');
    await user.click(screen.getByRole('button', { name: 'Activar tipo' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH' && JSON.stringify(JSON.parse(String(init.body))) === '{"active":true}')).toBe(true));
    expect(await screen.findByText('Tipo de paquete activado correctamente.')).toBeInTheDocument();
  });

  it('crea un tipo de paquete sin enviar active y muestra éxito', async () => {
    const fetcher = installFetch(admin);
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Tipos de paquete' }));
    await user.click(await screen.findByRole('link', { name: '+ Crear tipo de paquete' }));
    await user.type(screen.getByLabelText('Nombre'), 'Plan nuevo');
    await user.type(screen.getByLabelText('Créditos incluidos'), '12');
    await user.type(screen.getByLabelText('Duración en días'), '45');
    await user.click(screen.getByRole('button', { name: 'Crear tipo de paquete' }));
    expect(await screen.findByText('Tipo de paquete creado correctamente.')).toBeInTheDocument();
    const call = fetcher.mock.calls.find(([, init]) => init?.method === 'POST' && String(init.body).includes('Plan nuevo'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ name: 'Plan nuevo', classCredits: 12, durationDays: 45 });
    expect(screen.queryByLabelText(/créditos por clase/i)).not.toBeInTheDocument();
  });

  it('valida campos obligatorios del tipo antes de enviar', async () => {
    const fetcher = installFetch(admin);
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Tipos de paquete' }));
    await user.click(await screen.findByRole('link', { name: '+ Crear tipo de paquete' }));
    await user.click(screen.getByRole('button', { name: 'Crear tipo de paquete' }));
    expect(screen.getByText('Ingresá un nombre.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá una cantidad entera mayor que cero.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá una duración entera mayor que cero.')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input, init]) => init?.method === 'POST'
      && new URL(String(input)).pathname.endsWith('/api/v1/package-types'))).toBe(false);
  });

  it('envía PATCH parcial al editar solo un campo', async () => {
    const fetcher = installFetch(admin, { packageTypes: (_url, init) => {
      if (init?.method === 'PATCH') return response({ data: { ...packageType, classCredits: 10 } });
      if (/\/package-types\/3$/.test(new URL(String(_url)).pathname)) return response({ data: packageType });
      return response(page([packageType]));
    } });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Tipos de paquete' }));
    const row = await screen.findByRole('row', { name: /Plan mensual/ });
    within(row).getByText('Plan mensual', { selector: 'strong' });
    const monthlyPlanRow = await screen.findByRole('row', { name: /Plan mensual/ });
    await user.click(within(monthlyPlanRow).getByRole('link', { name: 'Editar tipo de paquete Plan mensual' }));
    const credits = await screen.findByLabelText('Créditos incluidos');
    await user.clear(credits); await user.type(credits, '10');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const patch = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ classCredits: 10 });
  });

  it('carga y deduplica todos los catálogos y asigna con el payload exacto', async () => {
    const userPageOne = [member];
    const userPageTwo = [member, activeMemberOther];
    const typePageOne = [packageType];
    const typePageTwo = [packageType, packageTypeOther];
    const fetcher = installFetch(admin, {
      users: (url) => {
        if (url.searchParams.get('active') !== 'true') return response(page([member, inactiveMember]));
        const pageNumber = Number(url.searchParams.get('page'));
        return response(page(pageNumber === 1 ? userPageOne : userPageTwo, pageNumber, 100, 101));
      },
      packageTypes: (url, init) => {
        if (init?.method === 'POST') return response({ data: packageRow() }, 201);
        if (url.pathname.endsWith('/package-types')) {
          const pageNumber = Number(url.searchParams.get('page'));
          return response(page(pageNumber === 1 ? typePageOne : typePageTwo, pageNumber, 100, 101));
        }
        return response({ data: packageType });
      },
    });
    const appUser = await enterAs(admin);
    await appUser.click(screen.getByRole('link', { name: 'Paquetes' }));
    await appUser.click(await screen.findByRole('link', { name: '+ Asignar paquete' }));
    const memberSelect = await screen.findByLabelText('Socio');
    const typeSelect = screen.getByLabelText('Tipo de paquete');
    expect(within(memberSelect).getAllByRole('option')).toHaveLength(3);
    expect(within(typeSelect).getAllByRole('option')).toHaveLength(3);
    expect(within(memberSelect).queryByRole('option', { name: /Histórico/ })).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('active=true&page=2'))).toBe(true);
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('page=2&pageSize=100') && String(input).includes('package-types'))).toBe(true);

    await appUser.selectOptions(memberSelect, String(member.id));
    await appUser.selectOptions(typeSelect, String(packageType.id));
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2030-02-04' } });
    await appUser.click(screen.getByRole('button', { name: 'Asignar paquete' }));
    expect(await screen.findByText('Paquete asignado correctamente.')).toBeInTheDocument();
    const assignment = fetcher.mock.calls.find(([, init]) => init?.method === 'POST' && String(init.body).includes('memberId'));
    expect(JSON.parse(String(assignment?.[1]?.body))).toEqual({ memberId: member.id, packageTypeId: packageType.id, startsOn: '2030-02-04' });
  });

  it('valida la asignación y conserva los datos si el backend devuelve un error', async () => {
    let posts = 0;
    const fetcher = installFetch(admin, { memberPackages: (_url, init) => {
      if (init?.method === 'POST') { posts += 1; return response({ error: { code: 'PACKAGE_ASSIGNMENT_EXISTS', message: 'El socio ya tiene ese paquete para esa fecha.', fields: {} } }, 409); }
      return response(page([]));
    } });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Paquetes' }));
    await user.click(await screen.findByRole('link', { name: '+ Asignar paquete' }));
    await screen.findByLabelText('Socio');
    await user.click(screen.getByRole('button', { name: 'Asignar paquete' }));
    expect(screen.getByText('Seleccioná un socio activo.')).toBeInTheDocument();
    expect(posts).toBe(0);
    await user.selectOptions(screen.getByLabelText('Socio'), String(member.id));
    await user.selectOptions(screen.getByLabelText('Tipo de paquete'), String(packageType.id));
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2030-02-04' } });
    await user.click(screen.getByRole('button', { name: 'Asignar paquete' }));
    expect(await screen.findByText('El socio ya tiene ese paquete para esa fecha.')).toBeInTheDocument();
    expect(screen.getByLabelText('Socio')).toHaveValue(String(member.id));
    expect(screen.getByLabelText('Tipo de paquete')).toHaveValue(String(packageType.id));
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('2030-02-04');
    expect(posts).toBe(1);
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/member-packages?'))).toBe(false);
  });

  it('filtra asignaciones administrativamente, conserva socios inactivos y envía expiringSoon=false', async () => {
    const fetcher = installFetch(admin, { users: () => response(page([member, inactiveMember])), memberPackages: () => response(page([packageRow()])) });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Paquetes' }));
    await screen.findByText('Plan mensual');
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('/users?role=MEMBER'))).toBe(true);
    await user.selectOptions(screen.getByLabelText('Socio'), String(inactiveMember.id));
    await user.selectOptions(screen.getByLabelText('Estado'), 'ACTIVE');
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('expiringSoon=') && String(input).includes('memberId='))).toBe(false);
    await user.selectOptions(screen.getByLabelText('Próximo vencimiento'), 'false');
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => String(input).includes('memberId=13') && String(input).includes('status=ACTIVE') && String(input).includes('expiringSoon=false'))).toBe(true));
    await user.selectOptions(screen.getByLabelText('Próximo vencimiento'), '');
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => String(input).includes('memberId=13') && String(input).includes('status=ACTIVE') && !String(input).includes('expiringSoon='))).toBe(true));
  });

  it('permite al socio filtrar sus paquetes sin enviar memberId y muestra estados y fechas civiles', async () => {
    const rows = [
      packageRow({ id: 51, status: 'NOT_STARTED', startsOn: '2030-02-05', expiresOn: '2030-03-06' }),
      packageRow({ id: 52, status: 'ACTIVE', expiringSoon: true, expiresOn: '2030-02-11' }),
      packageRow({ id: 53, status: 'EXHAUSTED', remainingCredits: 0 }),
      packageRow({ id: 54, status: 'EXPIRED', expiresOn: '2030-02-03' }),
    ];
    const fetcher = installFetch(member, { memberPackages: (url) => response(page(rows.filter((row) => !url.searchParams.get('status') || row.status === url.searchParams.get('status')))) });
    const user = await enterAs(member);
    await user.click(screen.getByRole('link', { name: 'Mis paquetes' }));
    const table = within(await screen.findByRole('table'));
    expect(await table.findByText('Pendiente de inicio')).toBeInTheDocument();
    expect(table.getByText('Activo')).toBeInTheDocument();
    expect(table.getByText('Sin créditos')).toBeInTheDocument();
    expect(table.getByText('Vencido')).toBeInTheDocument();
    expect(table.getByText('Próximo a vencer')).toBeInTheDocument();
    const activePackageRow = table.getByRole('row', { name: /Activo/ });
    expect(within(activePackageRow).getByText('04/02/2030')).toBeInTheDocument();
    expect(screen.queryByLabelText('Socio')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '+ Asignar paquete' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Estado'), 'ACTIVE');
    await user.selectOptions(screen.getByLabelText('Próximo vencimiento'), 'true');
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => String(input).includes('status=ACTIVE') && String(input).includes('expiringSoon=true'))).toBe(true));
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/member-packages')).every(([input]) => !new URL(String(input)).searchParams.has('memberId'))).toBe(true);
  });

  it('muestra el detalle propio y presenta el 403 de una asignación ajena', async () => {
    const fetcher = installFetch(member, { memberPackages: (url) => {
      if (url.pathname.endsWith('/member-packages/42')) return response({ error: { code: 'FORBIDDEN', message: 'No tenés permisos para consultar esta asignación.', fields: {} } }, 403);
      if (/\/member-packages\/\d+$/.test(url.pathname)) return response({ data: packageRow() });
      return response(page([packageRow()]));
    } });
    const user = await enterAs(member, '/login', '/socio/paquetes/42');
    await user.click(screen.getByRole('link', { name: 'Mis paquetes' }));
    await user.click(await screen.findByRole('link', { name: 'Ver detalle del paquete Plan mensual de Socia Paquetes' }));
    expect(await screen.findByRole('heading', { name: 'Plan mensual' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir ruta de prueba' }));
    expect(await screen.findByText('No tenés permisos para consultar esta asignación.')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/member-packages/41'))).toBe(true);
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/member-packages/42'))).toBe(true);
  });

  it('muestra detalle administrativo, saldo y momento de asignación en hora argentina', async () => {
    const fetcher = installFetch(admin, { memberPackages: (url) => /\/member-packages\/\d+$/.test(url.pathname) ? response({ data: packageRow() }) : response(page([packageRow()])) });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Paquetes' }));
    await user.click(await screen.findByRole('link', { name: 'Ver detalle del paquete Plan mensual de Socia Paquetes' }));
    expect(await screen.findByRole('heading', { name: 'Plan mensual' })).toBeInTheDocument();
    expect(screen.getByText('Socia Paquetes')).toBeInTheDocument();
    expect(screen.getByText('5 de 8 créditos')).toBeInTheDocument();
    expect(screen.getByText(/4 feb 2030, 12:00/)).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/member-packages/41'))).toBe(true);
  });

  it('presenta cargas, vacíos, errores con reintento y estados de éxito', async () => {
    let attempts = 0;
    let resolveFirst: (value: Response) => void = () => undefined;
    const fetcher = installFetch(admin, { packageTypes: () => {
      attempts += 1;
      if (attempts === 1) return new Promise<Response>((resolve) => { resolveFirst = resolve; });
      return response(page([]));
    } });
    const user = await enterAs(admin);
    await user.click(screen.getByRole('link', { name: 'Tipos de paquete' }));
    expect(await screen.findByText('Cargando tipos de paquete…')).toBeInTheDocument();
    resolveFirst(response({ error: { code: 'SERVER_ERROR', message: 'No se pudieron cargar los tipos.', fields: {} } }, 500));
    expect(await screen.findByText('No se pudieron cargar los tipos.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Todavía no hay tipos de paquete' })).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalled();
  });

  it('formatea fechas civiles sin conversión de zona y muestra instantes en Buenos Aires', () => {
    expect(formatCivilDate('2030-02-04')).toBe('04/02/2030');
    expect(formatCivilDate('2030-12-31')).toBe('31/12/2030');
    expect(isCivilDate('2030-02-29')).toBe(false);
    expect(isCivilDate('2032-02-29')).toBe(true);
    expect(formatBuenosAiresInstant('2030-02-04T15:00:00.000Z')).toMatch(/4 feb 2030, 12:00/);
  });
});
