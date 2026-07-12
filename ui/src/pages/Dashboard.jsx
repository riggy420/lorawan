import { useState, useEffect, useCallback } from 'react';
import {
  fetchRegions,
  fetchDeviceEUIs,
  fetchDoorIDs,
  fetchRecent,
  fetchStats,
} from '../api';
import { formatTime } from '../lib';

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

export default Dashboard;
