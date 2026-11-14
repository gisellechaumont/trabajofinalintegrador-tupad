import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { createHttpClient } from '../../shared/services/http';
import type { ApiData, HttpClient, LoginInput, Session, User } from '../../shared/types/api';

interface SessionValue {
  user: User | null; accessToken: string | null; api: HttpClient; notice: string;
  login(input: LoginInput): Promise<void>; logout(message?: string): void; updateUser(user: User): void;
}
const Context = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const tokenRef = useRef<string | null>(null);
  const generation = useRef(0);
  const logout = useCallback((message = '') => {
    generation.current += 1; tokenRef.current = null;
    setAccessToken(null); setUser(null); setExpiresAt(null); setNotice(message);
  }, []);
  const api = useMemo(() => createHttpClient(() => tokenRef.current, (failedToken) => {
    // Una respuesta vieja no debe cerrar una sesión nueva.
    if (tokenRef.current === failedToken) logout('Tu sesión finalizó. Volvé a iniciar sesión.');
  }), [logout]);
  const login = useCallback(async (input: LoginInput) => {
    const attempt = ++generation.current;
    const result = await api.request<ApiData<Session>>('/auth/login', { method: 'POST', body: input });
    if (attempt !== generation.current) return;
    tokenRef.current = result.data.accessToken;
    setAccessToken(result.data.accessToken); setUser(result.data.user); setNotice('');
    setExpiresAt(Date.now() + result.data.expiresIn * 1000);
  }, [api]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => logout('Tu sesión finalizó por seguridad. Volvé a iniciar sesión.'), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt, logout]);
  return <Context.Provider value={{ user, accessToken, api, notice, login, logout, updateUser: setUser }}>{children}</Context.Provider>;
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('Falta SessionProvider.');
  return value;
}
