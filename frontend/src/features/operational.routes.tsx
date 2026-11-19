import { Link, Route, Routes } from 'react-router-dom';
import { RequireRole } from '../app/router/guards';
import { useSession } from '../app/providers/SessionProvider';
import { Alert, PageHeader } from '../shared/components/ui';
import type { NavigationEntry } from '../shared/types/api';
import { ClassesPage } from './classes/ClassesPage.js';
import { ClassDetailPage } from './classes/ClassDetailPage.js';
import { ClassFormPage } from './classes/ClassFormPage.js';
import { PackageTypesPage } from './packages/PackageTypesPage.js';
import { PackageTypeFormPage } from './packages/PackageTypeFormPage.js';
import { MemberPackagesPage } from './packages/MemberPackagesPage.js';
import { MemberPackageAssignPage } from './packages/MemberPackageAssignPage.js';
import { MemberPackageDetailPage } from './packages/MemberPackageDetailPage.js';

/** Emilia agrega aquí SU navegación y pantallas sin editar AppLayout ni App.tsx. */
export const operationalNavigation: NavigationEntry[] = [
  {
    path: '/admin/clases',
    label: 'Clases',
    roles: ['ADMIN'],
  },
  {
    path: '/profesor/clases',
    label: 'Clases',
    roles: ['PROFESSOR'],
  },
  {
    path: '/socio/clases',
    label: 'Clases',
    roles: ['MEMBER'],
  },
  {
    path: '/admin/tipos-paquete',
    label: 'Tipos de paquete',
    roles: ['ADMIN'],
  },
  {
    path: '/admin/paquetes',
    label: 'Paquetes',
    roles: ['ADMIN'],
  },
  {
    path: '/socio/paquetes',
    label: 'Mis paquetes',
    roles: ['MEMBER'],
  },
];

function PendingOperations() {
  const { user } = useSession();
  return <><PageHeader eyebrow="GymFlow" title={`Hola, ${user?.name.split(' ')[0] ?? ''}`} description="Tu sesión está activa y los permisos ya están configurados." />
    <Alert tone="info">Esta entrega integra clases y paquetes. Inscripciones, asistencias, historiales y panel permanecen pendientes. No se muestran datos ni funciones simuladas.</Alert>
    {user?.role === 'ADMIN' ? <div className="quick-grid"><Link className="quick-card" to="/admin/socios"><span>01</span><h2>Socios</h2><p>Altas, datos y estado de las cuentas.</p><b>Gestionar socios →</b></Link><Link className="quick-card" to="/admin/profesores"><span>02</span><h2>Profesores</h2><p>Información y acceso del equipo.</p><b>Gestionar profesores →</b></Link><Link className="quick-card" to="/admin/actividades"><span>03</span><h2>Actividades</h2><p>Disciplinas disponibles en el gimnasio.</p><b>Gestionar actividades →</b></Link></div> : <section className="card account-intro"><h2>Tu cuenta ya está disponible</h2><p>Podés consultar y editar tu perfil, cambiar tu contraseña y cerrar sesión. Tus pantallas operativas se conectarán en este mismo espacio.</p><Link className="button secondary" to="/perfil">Ver mi perfil</Link></section>}
  </>;
}
export function OperationalRoutes() {
  return (
    <Routes>
      <Route element={<RequireRole roles={['ADMIN']} />}>
        <Route path="/admin/tipos-paquete" element={<PackageTypesPage />} />
        <Route path="/admin/tipos-paquete/nuevo" element={<PackageTypeFormPage />} />
        <Route path="/admin/tipos-paquete/:id/editar" element={<PackageTypeFormPage editing />} />
        <Route path="/admin/paquetes" element={<MemberPackagesPage />} />
        <Route path="/admin/paquetes/asignar" element={<MemberPackageAssignPage />} />
        <Route path="/admin/paquetes/:id" element={<MemberPackageDetailPage />} />
        <Route path="/admin/clases" element={<ClassesPage />} />
        <Route path="/admin/clases/nueva" element={<ClassFormPage />} />
        <Route path="/admin/clases/:id/editar" element={<ClassFormPage editing />} />
        <Route path="/admin/clases/:id" element={<ClassDetailPage />} />
        <Route path="/admin/*" element={<PendingOperations />} />
      </Route>

      <Route element={<RequireRole roles={['MEMBER']} />}>
        <Route path="/socio/paquetes" element={<MemberPackagesPage />} />
        <Route path="/socio/paquetes/:id" element={<MemberPackageDetailPage />} />
        <Route path="/socio/clases" element={<ClassesPage />} />
        <Route path="/socio/clases/:id" element={<ClassDetailPage />} />
        <Route path="/socio/*" element={<PendingOperations />} />
      </Route>

      <Route element={<RequireRole roles={['PROFESSOR']} />}>
        <Route path="/profesor/clases" element={<ClassesPage />} />
        <Route path="/profesor/clases/:id" element={<ClassDetailPage />} />
        <Route path="/profesor/*" element={<PendingOperations />} />
      </Route>

      <Route
        path="*"
        element={
          <section className="card">
            <PageHeader
              title="No encontramos esa página"
              description="Revisá la dirección o volvé a tu inicio desde el menú."
            />
          </section>
        }
      />
    </Routes>
  );
}
