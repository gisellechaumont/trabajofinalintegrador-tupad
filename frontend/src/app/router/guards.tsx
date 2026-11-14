import { Navigate, Outlet, Link } from 'react-router-dom';
import { useSession } from '../providers/SessionProvider';
import { homeForRole, type Role } from '../../shared/types/api';
import { PageHeader } from '../../shared/components/ui';

export function RequireAuth() {
  const { user } = useSession();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function AccessDenied() {
  const { user } = useSession();
  return <section className="card"><PageHeader eyebrow="Acceso restringido" title="Esta sección no está habilitada para tu rol" description="La cuenta sigue activa. Podés volver a tu inicio o consultar tu perfil." /><Link className="button secondary" to={user ? homeForRole(user.role) : '/login'}>Volver al inicio</Link></section>;
}
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  return roles.includes(user.role) ? <Outlet /> : <AccessDenied />;
}
