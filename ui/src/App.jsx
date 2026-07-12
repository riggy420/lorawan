import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Sensors from './pages/Sensors';

function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◉</span>
          <div>
            <div className="brand-name">VANGUARD</div>
            <div className="brand-subtitle">Sensor command deck</div>
          </div>
        </div>

        <nav className="nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">▣</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/sensors"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">◉</span>
            <span>Active Sensors</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="identity">
            <div className="avatar">A</div>
            <div>
              <div className="identity-label">SYSTEM ADMIN</div>
              <div className="identity-value">admin_root@vanguard</div>
            </div>
          </div>
          <button className="icon-button" type="button" aria-label="Settings">
            ⚙
          </button>
        </div>
      </aside>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sensors/*" element={<Sensors />} />
      </Routes>
    </div>
  );
}

export default App;
