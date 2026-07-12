import { useState, useEffect, useCallback } from 'react';
import {
  fetchRegions,
  fetchDeviceEUIs,
  fetchDoorIDs,
  fetchRecent,
  fetchStats,
  fetchSensorsByRegion,
  fetchSensorDetail,
} from './api';

const navItems = [
  { label: 'Dashboard', icon: '▣', page: 'dashboard' },
  { label: 'Active Sensors', icon: '◉', page: 'sensors' },
];

// formatTime converts an InfluxDB nanosecond timestamp to a readable
// local time string.
function formatTime(ns) {
  if (ns == null) return '—';
  const ms = Number(ns) / 1e6; // ns → ms
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════════════
// Dashboard view
// ═══════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [regions, setRegions] = useState([]);
  const [deviceEUIs, setDeviceEUIs] = useState([]);
  const [doorIDs, setDoorIDs] = useState([]);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState({ entriesPerHour: 0, estimated: false, uplinks: 0, downlinks: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchRegions(), fetchDeviceEUIs(), fetchDoorIDs(), fetchStats()])
      .then(([r, d, dr, s]) => {
        setRegions(r.regions || []);
        setDeviceEUIs(d.deviceEuis || []);
        setDoorIDs(dr.doorIds || []);
        setStats(s);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const loadRecent = useCallback(() => {
    fetchRecent()
      .then((data) => setRecent(data.entries || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRecent();
    const interval = setInterval(loadRecent, 5000);
    return () => clearInterval(interval);
  }, [loadRecent]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats().then((s) => setStats(s)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const formatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const metrics = [
    {
      label: 'Entries / hour',
      value: stats.estimated ? `~${Math.round(stats.entriesPerHour)}` : stats.entriesPerHour,
      accent: 'amber',
      caption: stats.estimated ? 'Estimated from interval' : 'Last 60 minutes',
    },
    { label: 'Active Devices', value: deviceEUIs.length, accent: 'emerald', caption: `Across ${regions.length || 0} region${regions.length !== 1 ? 's' : ''}` },
    { label: 'Door IDs', value: doorIDs.length, accent: 'cyan', caption: 'Unique door identifiers' },
  ];

  if (loading) {
    return (
      <main className="workspace" style={{ gridColumn: '1 / -1', display: 'grid', placeItems: 'center' }}>
        <p className="lead">Loading dashboard data…</p>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <label className="searchbar">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Search system sensors, nodes, or locations..." />
        </label>

        <div className="top-metrics">
          <div>
            <span className="metric-label">Devices</span>
            <strong>{deviceEUIs.length}</strong>
          </div>
          <div>
            <span className="metric-label">Regions</span>
            <strong>{regions.length}</strong>
          </div>
          <button className="status-pill live" type="button">
            <span className="status-dot" />
            Live uplink
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Real-time telemetry</p>
          <h1>Sensor Fleet Monitoring</h1>
          <p className="lead">
            {stats.entriesPerHour > 0
              ? `Processing ~${Math.round(stats.entriesPerHour)} entries/hour across ${deviceEUIs.length} devices in ${regions.length} region${regions.length !== 1 ? 's' : ''}.`
              : `Monitoring ${deviceEUIs.length} devices across ${regions.length} region${regions.length !== 1 ? 's' : ''}.`}
          </p>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className={`metric-card ${metric.accent}`}>
            <span className="metric-card-label">{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.caption}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="table-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Live feed</p>
              <h2>Recent entries</h2>
            </div>
            <div className="panel-meta">Auto-refresh every 5s</div>
          </div>

          <div className="sensor-list">
            {recent.length === 0 && (
              <p style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center' }}>
                No entries yet. Start the websocket listener to ingest data.
              </p>
            )}
            {recent.map((entry, i) => (
              <article key={i} className="sensor-row">
                <div className="sensor-main">
                  <div className={`status-glyph ${entry.msgtype === 'uplink' ? 'good' : 'muted'}`} />
                  <div>
                    <h3>{entry.DeviceEui
                      ? entry.DeviceEui.length > 18
                        ? `${entry.DeviceEui.slice(0, 18)}…`
                        : entry.DeviceEui
                      : '—'}</h3>
                    <p>{entry.msgtype || 'unknown'} · {formatTime(entry.time)}</p>
                  </div>
                </div>

                <div className="telemetry-column">
                  <strong>{entry.region || '—'}</strong>
                  <span>Region</span>
                </div>

                <div className="signal-column">
                  <span className="signal good">
                    {entry.rssi != null ? `RSSI ${Number(entry.rssi).toFixed(1)}` : '—'}
                  </span>
                  <small>dBm</small>
                </div>

                <div className="trend-column">
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>
                    SNR {entry.snr != null ? Number(entry.snr).toFixed(1) : '—'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="side-panel">
          <div className="panel-card">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Connection</p>
                <h2>Uplink health</h2>
              </div>
              <span className="status-pill live compact">
                <span className="status-dot" />
                {recent.length > 0 ? 'Live' : 'Idle'}
              </span>
            </div>
            <div className="mini-stats">
              <div>
                <span>Last sync</span>
                <strong>{formatted}</strong>
              </div>
              <div>
                <span>Devices</span>
                <strong>{deviceEUIs.length}</strong>
              </div>
              <div>
                <span>Est. hourly rate</span>
                <strong>{stats.estimated ? '~' : ''}{Math.round(stats.entriesPerHour)}</strong>
              </div>
            </div>
          </div>

          <div className="panel-card alerts">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Regions</p>
                <h2>Active regions</h2>
              </div>
            </div>
            <div className="alert-list">
              {regions.slice(0, 6).map((region) => (
                <article key={region} className="alert-item">
                  <div><strong>{region}</strong></div>
                  <span className="badge info">Active</span>
                </article>
              ))}
            </div>
          </div>

          <div className="panel-card alerts">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Door IDs</p>
                <h2>Access points</h2>
              </div>
            </div>
            <div className="alert-list">
              {doorIDs.slice(0, 6).map((door) => (
                <article key={door} className="alert-item">
                  <div><strong>{door}</strong></div>
                  <span className="badge stable">Active</span>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Sensors drill-down flow
// ═══════════════════════════════════════════════════════════════════════

// ── Level 1: Region summary ────────────────────────────────────────
function RegionList({ onSelectRegion, regions }) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    Promise.all(
      regions.map((r) =>
        fetchSensorsByRegion(r)
          .then((d) => ({ region: r, count: d.count }))
          .catch(() => ({ region: r, count: 0 }))
      )
    ).then((results) => {
      const map = {};
      results.forEach(({ region, count }) => { map[region] = count; });
      setCounts(map);
    });
  }, [regions]);

  if (regions.length === 0) {
    return (
      <main className="workspace">
        <div className="panel-header"><h2>No regions found</h2></div>
        <p className="lead">Start the websocket listener to ingest data.</p>
      </main>
    );
  }

  return (
    <main className="workspace">
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sensor fleet</p>
          <h1>Regions</h1>
          <p className="lead">{regions.length} region{regions.length !== 1 ? 's' : ''} with active sensors.</p>
        </div>
      </div>

      <div className="metrics-grid">
        {regions.map((region) => (
          <article
            key={region}
            className="metric-card emerald"
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectRegion(region)}
          >
            <span className="metric-card-label">Region</span>
            <strong style={{ fontSize: 'clamp(1.2rem, 2vw, 1.6rem)', wordBreak: 'break-all' }}>{region}</strong>
            <p>{counts[region] != null ? `${counts[region]} device${counts[region] !== 1 ? 's' : ''}` : 'Loading…'}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

// ── Level 2: Sensor list in a region ──────────────────────────────
function SensorList({ region, onSelectSensor }) {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSensorsByRegion(region)
      .then((d) => { setSensors(d.sensors || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [region]);

  if (loading) {
    return (
      <main className="workspace" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="lead">Loading sensors in {region}…</p>
      </main>
    );
  }

  return (
    <main className="workspace">
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{region}</p>
          <h1>Sensors</h1>
          <p className="lead">{sensors.length} device{sensors.length !== 1 ? 's' : ''} in this region.</p>
        </div>
      </div>

      <div className="table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Device EUI</p>
            <h2>Active sensors</h2>
          </div>
          <div className="panel-meta">{sensors.length} device{sensors.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="sensor-list">
          {sensors.map((sensor) => (
            <article
              key={sensor.deviceEui}
              className="sensor-row"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectSensor(sensor.deviceEui)}
            >
              <div className="sensor-main">
                <div className="status-glyph good" />
                <div>
                  <h3>{sensor.deviceEui.length > 18 ? `${sensor.deviceEui.slice(0, 18)}…` : sensor.deviceEui}</h3>
                  <p>EUI: {sensor.deviceEui}</p>
                </div>
              </div>
              <div className="status-column">
                <span className="badge good">Active</span>
              </div>
              <div className="telemetry-column">
                <strong>{formatTime(sensor.latestTime)}</strong>
                <span>Last seen</span>
              </div>
              <div className="signal-column">
                <span className="signal good">Online</span>
                <small>Click for details</small>
              </div>
              <div className="trend-column" />
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

// ── Level 3: Individual sensor detail ─────────────────────────────
function SensorDetail({ eui }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(() => {
    fetchSensorDetail(eui)
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [eui]);

  useEffect(() => {
    setLoading(true);
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const interval = setInterval(loadDetail, 5000);
    return () => clearInterval(interval);
  }, [loadDetail]);

  if (loading) {
    return (
      <main className="workspace" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="lead">Loading sensor details…</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="workspace">
        <p className="lead">Failed to load sensor details.</p>
      </main>
    );
  }

  return (
    <main className="workspace">
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{detail.region || 'Unknown region'}</p>
          <h1 style={{ fontSize: 'clamp(1.2rem, 2vw, 1.8rem)', wordBreak: 'break-all' }}>{detail.deviceEui}</h1>
          <p className="lead">
            {detail.uplinks} uplinks · {detail.downlinks} downlinks
          </p>
        </div>
      </div>

      <section className="metrics-grid">
        <article className="metric-card emerald">
          <span className="metric-card-label">Latest RSSI</span>
          <strong>{detail.latestRssi ? detail.latestRssi.toFixed(1) : '—'}</strong>
          <p>Signal strength (dBm)</p>
        </article>
        <article className="metric-card cyan">
          <span className="metric-card-label">Latest SNR</span>
          <strong>{detail.latestSnr ? detail.latestSnr.toFixed(1) : '—'}</strong>
          <p>Signal-to-noise ratio</p>
        </article>
        <article className="metric-card amber">
          <span className="metric-card-label">Messages</span>
          <strong>{detail.uplinks + detail.downlinks}</strong>
          <p>{detail.uplinks} up / {detail.downlinks} down</p>
        </article>
      </section>

      <div className="table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Recent activity</p>
            <h2>Last {detail.entries.length} entries</h2>
          </div>
          <div className="panel-meta">Auto-refresh every 5s</div>
        </div>

        <div className="sensor-list">
          {detail.entries.length === 0 && (
            <p style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center' }}>No entries.</p>
          )}
          {detail.entries.map((entry, i) => (
            <article key={i} className="sensor-row">
              <div className="sensor-main">
                <div className={`status-glyph ${entry.msgtype === 'uplink' ? 'good' : 'muted'}`} />
                <div>
                  <h3>DevAddr: {entry.DevAddr || '—'}</h3>
                  <p>{entry.msgtype || 'unknown'} · {formatTime(entry.time)}</p>
                </div>
              </div>
              <div className="status-column">
                <span className={`badge ${entry.msgtype === 'uplink' ? 'good' : 'muted'}`}>
                  {entry.msgtype || '—'}
                </span>
              </div>
              <div className="telemetry-column">
                <strong>{entry.Freq ? (Number(entry.Freq) / 1e6).toFixed(3) : '—'}</strong>
                <span>Freq (MHz)</span>
              </div>
              <div className="signal-column">
                <span className="signal good">
                  {entry.rssi != null ? `RSSI ${Number(entry.rssi).toFixed(1)}` : '—'}
                </span>
                <small>DR {entry.DR ?? '—'}</small>
              </div>
              <div className="trend-column">
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  SNR {entry.snr != null ? Number(entry.snr).toFixed(1) : '—'}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// App shell — owns navigation state
// ═══════════════════════════════════════════════════════════════════════
function App() {
  const [page, setPage] = useState('dashboard');
  const [sensorView, setSensorView] = useState('regions'); // 'regions' | 'sensors' | 'detail'
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [regions, setRegions] = useState([]);

  // Pre-fetch regions for the sensors nav.
  useEffect(() => {
    fetchRegions()
      .then((d) => setRegions(d.regions || []))
      .catch(() => {});
  }, []);

  const goToSensors = () => {
    setPage('sensors');
    setSensorView('regions');
    setSelectedRegion(null);
    setSelectedSensor(null);
  };

  const goToDashboard = () => {
    setPage('dashboard');
  };

  const handleSelectRegion = (region) => {
    setSelectedRegion(region);
    setSensorView('sensors');
    setSelectedSensor(null);
  };

  const handleSelectSensor = (eui) => {
    setSelectedSensor(eui);
    setSensorView('detail');
  };

  const handleBack = () => {
    if (sensorView === 'detail') {
      setSensorView('sensors');
      setSelectedSensor(null);
    } else if (sensorView === 'sensors') {
      setSensorView('regions');
      setSelectedRegion(null);
    }
  };

  const activePage = page;
  const isSensorFlow = page === 'sensors';

  const navWithState = navItems.map((item) => ({
    ...item,
    active: item.page === activePage,
  }));

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
          {navWithState.map((item) => (
            <button
              key={item.label}
              className={`nav-item${item.active ? ' active' : ''}`}
              type="button"
              onClick={item.page === 'dashboard' ? goToDashboard : goToSensors}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
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

      {/* Breadcrumb for sensor drill-down */}
      {isSensorFlow && sensorView !== 'regions' && (
        <div style={{ position: 'absolute', top: 26, left: 320, zIndex: 10 }}>
          <button
            className="ghost-button"
            type="button"
            onClick={handleBack}
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            ← Back
          </button>
          {sensorView === 'detail' && selectedRegion && (
            <span style={{ marginLeft: 12, color: 'var(--muted)', fontSize: '0.82rem' }}>
              {selectedRegion} &rsaquo; {selectedSensor ? (selectedSensor.length > 14 ? `${selectedSensor.slice(0, 14)}…` : selectedSensor) : ''}
            </span>
          )}
          {sensorView === 'sensors' && selectedRegion && (
            <span style={{ marginLeft: 12, color: 'var(--muted)', fontSize: '0.82rem' }}>
              {selectedRegion}
            </span>
          )}
        </div>
      )}

      {page === 'dashboard' && <Dashboard />}

      {page === 'sensors' && sensorView === 'regions' && (
        <RegionList regions={regions} onSelectRegion={handleSelectRegion} />
      )}

      {page === 'sensors' && sensorView === 'sensors' && selectedRegion && (
        <SensorList region={selectedRegion} onSelectSensor={handleSelectSensor} />
      )}

      {page === 'sensors' && sensorView === 'detail' && selectedSensor && (
        <SensorDetail eui={selectedSensor} />
      )}
    </div>
  );
}

export default App;
