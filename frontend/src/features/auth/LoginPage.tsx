import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { ApiError, errorMessage } from '../../shared/services/http';
import { Alert, Button, Field } from '../../shared/components/ui';
import { homeForRole } from '../../shared/types/api';

export function LoginPage() {
  const { user, login, notice } = useSession();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  if (user) return <Navigate replace to={homeForRole(user.role)} />;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setFields({});
    try { await login({ email, password }); }
    catch (failure) { setError(errorMessage(failure)); if (failure instanceof ApiError) setFields(failure.fields); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><aside className="login-story"><Link className="brand" to="/"><span className="brand-mark">G</span>GymFlow.</Link><div><p className="eyebrow">TU GIMNASIO, EN ORDEN</p><h1>Un lugar para<br />cada movimiento.</h1><p>Ingresá con la cuenta que te asignó administración. Cada rol tiene su propio espacio.</p></div><small>Proyecto académico · UTN TUPaD</small></aside><main className="login-form-wrap"><form className="login-form" onSubmit={submit}><p className="eyebrow">BIENVENIDA / BIENVENIDO</p><h2>Iniciar sesión</h2><p className="muted">Ingresá tus datos para continuar.</p>{notice && <Alert tone="info">{notice}</Alert>}{error && <Alert>{error}</Alert>}<Field label="Correo electrónico" type="email" autoComplete="username" required maxLength={255} value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} error={fields.email} placeholder="nombre@correo.com" /><Field label="Contraseña" type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} error={fields.password} /><Button disabled={busy} className="full-width" type="submit">{busy ? 'Ingresando…' : 'Ingresar'}</Button><p className="login-help">Si no tenés acceso, consultá con administración. No hay registro público ni recuperación automática por correo.</p><Link className="text-link" to="/">← Volver al inicio</Link></form></main></div>;
}
