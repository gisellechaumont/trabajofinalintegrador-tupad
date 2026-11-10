import { describe, it, expect, vi } from 'vitest';
import { ApiError, createHttpClient } from '../src/shared/services/http';

describe('cliente HTTP compartido', () => {
  it('envía Bearer en header, JSON y la ruta del contrato', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 1 } }), { status: 200 })); vi.stubGlobal('fetch', fetcher);
    const client = createHttpClient(() => 'token-local-de-prueba', vi.fn(), 'http://localhost:3000/api/v1');
    const data = await client.request('/users', { method: 'POST', body: { name: 'Ana' } });
    expect(data).toEqual({ data: { id: 1 } }); expect(fetcher).toHaveBeenCalledWith('http://localhost:3000/api/v1/users', expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer token-local-de-prueba', 'Content-Type': 'application/json' }, body: '{"name":"Ana"}' }));
  });
  it('204 no intenta leer un cuerpo inexistente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(createHttpClient(() => null, vi.fn(), 'http://localhost').request('/auth/password', { method: 'PUT', body: {} })).resolves.toBeUndefined();
  });
  it('401 notifica la sesión fallida y conserva código/campos del error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'INVALID_SESSION', message: 'Sesión vencida', fields: {} } }), { status: 401 })));
    const unauthorized = vi.fn(); const client = createHttpClient(() => 'anterior', unauthorized, 'http://localhost');
    await expect(client.request('/auth/me')).rejects.toMatchObject({ status: 401, code: 'INVALID_SESSION' }); expect(unauthorized).toHaveBeenCalledWith('anterior');
  });
  it('403 no cierra la sesión y responde como error comprensible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'No autorizado', fields: {} } }), { status: 403 })));
    const unauthorized = vi.fn(); await expect(createHttpClient(() => 'token', unauthorized, 'http://localhost').request('/users')).rejects.toBeInstanceOf(ApiError); expect(unauthorized).not.toHaveBeenCalled();
  });
  it('no admite un destino absoluto ni //externo que pudiera recibir el token', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); const client = createHttpClient(() => 'token', vi.fn(), 'http://localhost');
    await expect(client.request('https://otro.example')).rejects.toThrow(); await expect(client.request('//otro.example')).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  });
});
