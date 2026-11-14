import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmDialog, Field, Pagination, StatusBadge } from '../src/shared/components/ui';
import { SessionProvider } from '../src/app/providers/SessionProvider';
import { AppRoutes } from '../src/app/App';

describe('componentes y acceso', () => {
  it('campos tienen etiqueta y error asociado', () => {
    render(<Field label="Correo" error="Revisá el correo" />);
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true'); expect(screen.getByRole('alert')).toHaveTextContent('Revisá el correo');
  });
  it('estados tienen texto, no dependen solo del color', () => {
    render(<><StatusBadge active /><StatusBadge active={false} /></>); expect(screen.getByText('Activo')).toBeInTheDocument(); expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });
  it('paginación respeta límites', async () => {
    const onChange = vi.fn(); render(<Pagination page={1} pageSize={10} total={12} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled(); await userEvent.click(screen.getByRole('button', { name: 'Siguiente' })); expect(onChange).toHaveBeenCalledWith(2);
  });
  it('confirmación de desactivación exige una acción explícita', async () => {
    const confirm = vi.fn(); render(<ConfirmDialog open title="Desactivar cuenta" confirmLabel="Confirmar" onConfirm={confirm} onClose={vi.fn()}>El historial se conserva.</ConfirmDialog>);
    expect(confirm).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toHaveTextContent('El historial se conserva.'); await userEvent.click(screen.getByRole('button', { name: 'Confirmar' })); expect(confirm).toHaveBeenCalledOnce();
  });
  it('una ruta privada sin sesión redirige a login', () => {
    render(<SessionProvider><MemoryRouter initialEntries={['/admin/socios']}><AppRoutes /></MemoryRouter></SessionProvider>);
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Socios' })).not.toBeInTheDocument();
  });
  it('login completa el flujo real del proveedor y permite logout sin persistir token', async () => {
    const user = userEvent.setup(); const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { accessToken: 'token-solo-memoria', tokenType: 'Bearer', expiresIn: 3600, user: { id: 3, name: 'Socia Demo', email: 'demo@gymflow.test', role: 'MEMBER', active: true } } }), { status: 200 })); vi.stubGlobal('fetch', fetcher);
    const local = vi.spyOn(Storage.prototype, 'setItem');
    render(<SessionProvider><MemoryRouter initialEntries={['/login']}><AppRoutes /></MemoryRouter></SessionProvider>);
    await user.type(screen.getByLabelText('Correo electrónico'), 'demo@gymflow.test'); await user.type(screen.getByLabelText('Contraseña'), 'clave-ficticia-larga'); await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('heading', { name: 'Hola, Socia' })).toBeInTheDocument(); expect(screen.getByText(/no se muestran datos ni funciones simuladas/i)).toBeInTheDocument(); expect(local).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' })); expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument(); expect(screen.getByText('Cerraste sesión correctamente.')).toBeInTheDocument();
  });
});
