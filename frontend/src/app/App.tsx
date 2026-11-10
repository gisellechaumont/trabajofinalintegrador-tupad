import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './providers/SessionProvider';
import { RequireAuth, RequireRole } from './router/guards';
import { AppLayout } from '../shared/layouts/AppLayout';
import { LandingPage } from '../features/auth/LandingPage';
import { LoginPage } from '../features/auth/LoginPage';
import { ProfilePage } from '../features/auth/ProfilePage';
import { PasswordPage } from '../features/auth/PasswordPage';
import { UsersPage } from '../features/users/UsersPage';
import { UserFormPage } from '../features/users/UserFormPage';
import { UserDetailPage } from '../features/users/UserDetailPage';
import { ActivitiesPage } from '../features/activities/ActivitiesPage';
import { ActivityFormPage } from '../features/activities/ActivityFormPage';
import { OperationalRoutes } from '../features/operational.routes';

export function AppRoutes() {
  return <Routes>
    <Route path="/" element={<LandingPage />} /><Route path="/login" element={<LoginPage />} />
    <Route element={<RequireAuth />}><Route element={<AppLayout />}>
      <Route path="/perfil" element={<ProfilePage />} /><Route path="/cambiar-contrasena" element={<PasswordPage />} />
      <Route element={<RequireRole roles={['ADMIN']} />}>
        <Route path="/admin/socios" element={<UsersPage key="members" role="MEMBER" />} />
        <Route path="/admin/socios/nuevo" element={<UserFormPage key="member-create" role="MEMBER" />} />
        <Route path="/admin/socios/:id" element={<UserDetailPage role="MEMBER" />} />
        <Route path="/admin/socios/:id/editar" element={<UserFormPage editing role="MEMBER" />} />
        <Route path="/admin/profesores" element={<UsersPage key="professors" role="PROFESSOR" />} />
        <Route path="/admin/profesores/nuevo" element={<UserFormPage key="professor-create" role="PROFESSOR" />} />
        <Route path="/admin/profesores/:id" element={<UserDetailPage role="PROFESSOR" />} />
        <Route path="/admin/profesores/:id/editar" element={<UserFormPage editing role="PROFESSOR" />} />
        <Route path="/admin/actividades" element={<ActivitiesPage />} />
        <Route path="/admin/actividades/nueva" element={<ActivityFormPage key="activity-create" />} />
        <Route path="/admin/actividades/:id/editar" element={<ActivityFormPage editing />} />
      </Route>
      <Route path="/*" element={<OperationalRoutes />} />
    </Route></Route>
  </Routes>;
}
export function App() { return <SessionProvider><BrowserRouter><AppRoutes /></BrowserRouter></SessionProvider>; }
