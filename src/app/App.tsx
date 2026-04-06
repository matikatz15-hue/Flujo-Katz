import { NavLink, Route, Routes } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ChecksPage } from '../pages/ChecksPage';
import { CajaPage } from '../pages/CajaPage';
import { DailyCashPage } from '../pages/DailyCashPage';
import { MonthlySummaryPage } from '../pages/MonthlySummaryPage';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/caja', label: 'Caja' },
  { to: '/cheques', label: 'Cheques' },
  { to: '/caja-diaria', label: 'Caja diaria' },
  { to: '/resumen-mensual', label: 'Resumen mensual' }
];

export function App() {
  return (
    <div className="app-shell">
      <aside>
        <h1>Flujo Katz</h1>
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
          <Route path="/" element={<DashboardPage />} />
          <Route path="/movimientos" element={<TransactionsPage />} />
          <Route path="/caja" element={<CajaPage />} />
          <Route path="/cheques" element={<ChecksPage />} />
          <Route path="/caja-diaria" element={<DailyCashPage />} />
          <Route path="/resumen-mensual" element={<MonthlySummaryPage />} />
        </Routes>
      </main>
    </div>
  );
}
