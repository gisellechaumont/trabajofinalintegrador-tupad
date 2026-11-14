export type Role = 'ADMIN' | 'PROFESSOR' | 'MEMBER';
export interface User { id: number; name: string; email: string; role: Role; active: boolean }
export interface Activity { id: number; name: string; description: string | null; active: boolean }
export interface ApiData<T> { data: T }
export interface ApiPage<T> { data: T[]; meta: { page: number; pageSize: number; total: number } }
export interface ApiErrorBody { error: { code: string; message: string; fields: Record<string, string> } }
export interface Session { accessToken: string; tokenType: 'Bearer'; expiresIn: number; user: User }
export interface LoginInput { email: string; password: string }
export interface NavigationEntry { path: string; label: string; roles: Role[] }
export interface HttpClient {
  request<T>(path: string, options?: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: unknown; signal?: AbortSignal }): Promise<T>;
}
export const roleLabels: Record<Role, string> = { ADMIN: 'Administrador', PROFESSOR: 'Profesor', MEMBER: 'Socio' };
export const homeForRole = (role: Role) => ({ ADMIN: '/admin', PROFESSOR: '/profesor', MEMBER: '/socio' })[role];
