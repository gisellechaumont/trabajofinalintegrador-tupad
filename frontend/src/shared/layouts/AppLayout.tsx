import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { Button } from '../components/ui';
import { homeForRole, roleLabels, type NavigationEntry } from '../types/api';
import { operationalNavigation } from '../../features/operational.routes';

const administration: NavigationEntry[] = [
  { path: '/admin/socios', label: 'Socios', roles: ['ADMIN'] },
  { path: '/admin/profesores', label: 'Profesores', roles: ['ADMIN'] },
  { path: '/admin/actividades', label: 'Actividades', roles: ['ADMIN'] },
];
export function AppLayout() {
  const { user, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  if (!user) return null;
  const entries = [...administration, ...operationalNavigation].filter((entry) => entry.roles.includes(user.role));
  function closeSession() { logout('Cerraste sesión correctamente.'); navigate('/login', { replace: true }); }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Ir al contenido</a>
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
      <Link to={homeForRole(user.role)} className="brand"><span className="brand-mark" aria-hidden="true">G</span>GymFlow<span className="brand-period">.</span></Link>
      <p className="sidebar-caption">ESPACIO DE GESTIÓN</p>
      <nav aria-label="Navegación principal" onClick={() => setMenuOpen(false)}>
        <NavLink end to={homeForRole(user.role)}>Inicio</NavLink>
        {entries.map((entry) => <NavLink key={entry.path} to={entry.path}>{entry.label}</NavLink>)}
      </nav>
      <div className="sidebar-bottom"><span className="sidebar-caption">TU CUENTA</span><NavLink to="/perfil">Mi perfil</NavLink><NavLink to="/cambiar-contrasena">Cambiar contraseña</NavLink><button className="logout-link" onClick={closeSession}>Cerrar sesión</button><small>Proyecto académico · UTN TUPaD</small></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div><Button className="mobile-menu" variant="ghost" aria-label="Abrir o cerrar menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</Button><span className="topbar-label">Tu gimnasio, en orden.</span></div><div className="account-summary"><span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><span>{roleLabels[user.role]}</span></div></div></header>
      <main id="main-content" className="main-content"><Outlet /></main>
    </div>
  </div>;
}
