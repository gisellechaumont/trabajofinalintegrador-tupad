import type { ApiErrorBody, HttpClient } from '../types/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string, string> = {}) { super(message); }
}
export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No pudimos conectar con el servidor. Verificá que la API esté encendida e intentá nuevamente.';
}
export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

export function createHttpClient(getToken: () => string | null, onUnauthorized: (token: string) => void, baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'): HttpClient {
  const root = baseUrl.replace(/\/$/, '');
  return {
    async request<T>(path: string, options: NonNullable<Parameters<HttpClient['request']>[1]> = {}): Promise<T> {
      if (!path.startsWith('/') || path.startsWith('//')) throw new Error('La ruta de API debe ser relativa.');
      const token = getToken();
      const response = await fetch(root + path, {
        method: options.method ?? 'GET', signal: options.signal,
        headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      if (response.status === 204 && response.ok) return undefined as T;
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 && token) onUnauthorized(token);
        const payload = json as Partial<ApiErrorBody> | null;
        const message = payload?.error?.message;
        throw new ApiError(response.status, payload?.error?.code || 'HTTP_ERROR', typeof message === 'string' ? message : 'No se pudo completar la operación.', payload?.error?.fields || {});
      }
      return json as T;
    },
  };
}
