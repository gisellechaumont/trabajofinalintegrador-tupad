import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/app/App';
import { SessionProvider } from '../src/app/providers/SessionProvider';

const admin = { id: 1, name: 'Admin Demo', email: 'admin@gymflow.test', role: 'ADMIN', active: true };
const member = { id: 7, name: 'Persona Nueva', email: 'persona@gymflow.test', role: 'MEMBER', active: true };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
async function signIn() {
  const user = userEvent.setup();
  render(<SessionProvider><MemoryRouter initialEntries={['/login']}><AppRoutes /></MemoryRouter></SessionProvider>);
  await user.type(screen.getByLabelText('Correo electrónico'), 'admin@gymflow.test'); await user.type(screen.getByLabelText('Contraseña'), 'clave-ficticia-de-prueba'); await user.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('heading', { name: 'Hola, Admin' }); return user;
}

describe('formularios conectados al cliente HTTP', () => {
  it('registra un socio enviando MEMBER, sin exponer una opción ADMIN', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/login')) return response({ data: { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 3600, user: admin } });
      if (path.endsWith('/users') && options?.method === 'POST') return response({ data: member }, 201);
      if (path.endsWith('/users/7')) return response({ data: member });
      return response({ data: [], meta: { page: 1, pageSize: 10, total: 0 } });
    }); vi.stubGlobal('fetch', fetcher);
    const user = await signIn(); await user.click(screen.getByRole('link', { name: 'Socios' }));
    await screen.findByRole('heading', { name: 'Todavía no hay socios' }); await user.click(screen.getByRole('link', { name: '+ Registrar socio' }));
    await user.type(screen.getByLabelText('Nombre y apellido'), member.name); await user.type(screen.getByLabelText('Correo electrónico'), member.email); await user.type(screen.getByLabelText('Contraseña inicial'), 'nueva-clave-de-prueba'); await user.click(screen.getByRole('button', { name: 'Registrar socio' }));
    expect(await screen.findByRole('heading', { name: 'Persona Nueva' })).toBeInTheDocument(); expect(screen.getByText('Socio registrado correctamente.')).toBeInTheDocument();
    const created = fetcher.mock.calls.find(([, options]) => options?.method === 'POST' && String(options.body).includes('Persona Nueva'));
    expect(JSON.parse(String(created?.[1]?.body))).toMatchObject({ role: 'MEMBER', name: member.name });
  });
  it('confirma desactivación explícita y actualiza estado del listado', async () => {
    let active = true;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/login')) return response({ data: { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 3600, user: admin } });
      if (path.endsWith('/users/7') && options?.method === 'PATCH') { active = false; return response({ data: { ...member, active } }); }
      return response({ data: [{ ...member, active }], meta: { page: 1, pageSize: 10, total: 1 } });
    }));
    const user = await signIn(); await user.click(screen.getByRole('link', { name: 'Socios' }));
    await screen.findByText('Persona Nueva'); await user.click(screen.getByRole('button', { name: 'Desactivar a Persona Nueva' }));
    expect(active).toBe(true); expect(screen.getByRole('dialog')).toHaveTextContent('Su historial se conserva');
    await user.click(screen.getByRole('button', { name: 'Desactivar cuenta' }));
    await waitFor(() => expect(active).toBe(false)); expect(await screen.findByText('Inactivo')).toBeInTheDocument();
  });
  it('guarda una actividad con el nombre y descripción del formulario', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/login')) return response({ data: { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 3600, user: admin } });
      if (options?.method === 'POST') return response({ data: { id: 2, name: 'Yoga suave', description: 'Grupo inicial', active: true } }, 201);
      return response({ data: [], meta: { page: 1, pageSize: 10, total: 0 } });
    }); vi.stubGlobal('fetch', fetcher);
    const user = await signIn(); await user.click(screen.getByRole('link', { name: 'Actividades' }));
    await screen.findByRole('heading', { name: 'Todavía no hay actividades' }); await user.click(screen.getByRole('link', { name: '+ Crear actividad' }));
    await user.type(screen.getByLabelText('Nombre de la actividad'), 'Yoga suave'); await user.type(screen.getByLabelText('Descripción (opcional)'), 'Grupo inicial'); await user.click(screen.getByRole('button', { name: 'Crear actividad' }));
    await screen.findByRole('heading', { name: 'Actividades' });
    expect(screen.getByText('Actividad creada correctamente.')).toBeInTheDocument();
    const created = fetcher.mock.calls.find(([, options]) => options?.method === 'POST' && String(options.body).includes('Yoga suave'));
    expect(JSON.parse(String(created?.[1]?.body))).toEqual({ name: 'Yoga suave', description: 'Grupo inicial' });
  });
});
