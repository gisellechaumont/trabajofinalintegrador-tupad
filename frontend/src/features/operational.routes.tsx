import { Link, Route, Routes } from 'react-router-dom';
import { RequireRole } from '../app/router/guards';
import { useSession } from '../app/providers/SessionProvider';
import { Alert, PageHeader } from '../shared/components/ui';
import type { NavigationEntry } from '../shared/types/api';

/** Emilia agrega aquí SU navegación y pantallas sin editar AppLayout ni App.tsx. */
export const operationalNavigation: NavigationEntry[] = [];

function PendingOperations() {
  const { user } = useSession();
  return <><PageHeader eyebrow="GymFlow" title={`Hola, ${user?.name.split(' ')[0] ?? ''}`} description="Tu sesión está activa y los permisos ya están configurados." />
    <Alert tone="info">Esta entrega implementa la base y los módulos de Giselle. Clases, paquetes, inscripciones, asistencia y panel quedan para la integración de Emilia. No se muestran datos ni funciones simuladas.</Alert>
    {user?.role === 'ADMIN' ? <div className="quick-grid"><Link className="quick-card" to="/admin/socios"><span>01</span><h2>Socios</h2><p>Altas, datos y estado de las cuentas.</p><b>Gestionar socios →</b></Link><Link className="quick-card" to="/admin/profesores"><span>02</span><h2>Profesores</h2><p>Información y acceso del equipo.</p><b>Gestionar profesores →</b></Link><Link className="quick-card" to="/admin/actividades"><span>03</span><h2>Actividades</h2><p>Disciplinas disponibles en el gimnasio.</p><b>Gestionar actividades →</b></Link></div> : <section className="card account-intro"><h2>Tu cuenta ya está disponible</h2><p>Podés consultar y editar tu perfil, cambiar tu contraseña y cerrar sesión. Tus pantallas operativas se conectarán en este mismo espacio.</p><Link className="button secondary" to="/perfil">Ver mi perfil</Link></section>}
  </>;
}
export function OperationalRoutes() {
  return <Routes>
    <Route element={<RequireRole roles={['ADMIN']} />}><Route path="/admin/*" element={<PendingOperations />} /></Route>
    <Route element={<RequireRole roles={['MEMBER']} />}><Route path="/socio/*" element={<PendingOperations />} /></Route>
    <Route element={<RequireRole roles={['PROFESSOR']} />}><Route path="/profesor/*" element={<PendingOperations />} /></Route>
    <Route path="*" element={<section className="card"><PageHeader title="No encontramos esa página" description="Revisá la dirección o volvé a tu inicio desde el menú." /></section>} />
  </Routes>;
}
