import { NavLink, Route, Routes } from 'react-router-dom';
import { MovementsPage } from '../pages/MovementsPage';
import { CashPage } from '../pages/CashPage';
import { ChecksPage } from '../pages/ChecksPage';
import { ProjectionsPage } from '../pages/ProjectionsPage';

const links = [
  { to: '/movimientos', label: '1. Movimientos' },
  { to: '/caja', label: '2. Caja' },
  { to: '/cheques', label: '3. Cheques' },
  { to: '/proyecciones', label: '4. Proyecciones' }
];

export function App() {
  return (
    <div className="app-shell">
      <aside>
        <h1>Flujo Katz</h1>
        <p className="sidebar-subtitle">Módulos financieros</p>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'active-link' : '')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<MovementsPage />} />
          <Route path="/movimientos" element={<MovementsPage />} />
          <Route path="/caja" element={<CashPage />} />
          <Route path="/cheques" element={<ChecksPage />} />
          <Route path="/proyecciones" element={<ProjectionsPage />} />
        </Routes>
      </main>
    </div>
  );
}
