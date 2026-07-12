import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchRegions, fetchSensorsByRegion, fetchSensorDetail } from '../api';
import { formatTime } from '../lib';

// ── Level 1: Region summary ────────────────────────────────────────
function RegionList() {
  const [regions, setRegions] = useState([]);
  const [counts, setCounts] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchRegions()
      .then((d) => setRegions(d.regions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (regions.length === 0) return;
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
            onClick={() => navigate(encodeURIComponent(region))}
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
function SensorList() {
  const { region } = useParams();
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSensorsByRegion(region)
      .then((d) => { setSensors(d.sensors || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [region]);

  if (loading) {
    return (
      <main className="workspace" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="lead">Loading sensors in {region}...</p>
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
              onClick={() => navigate(encodeURIComponent(sensor.deviceEui))}
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
function SensorDetail() {
  const { eui } = useParams();
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

// ── Sensors shell with nested routes ──────────────────────────────
function Sensors() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine breadcrumb from current path.
  // Paths: /sensors, /sensors/:region, /sensors/:region/:eui
  const pathParts = location.pathname.replace(/^\/sensors\/?/, '').split('/').filter(Boolean);
  const isRoot = pathParts.length === 0;

  return (
    <>
      {!isRoot && (
        <div style={{ position: 'absolute', top: 26, left: 320, zIndex: 10 }}>
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate(-1)}
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            ← Back
          </button>
          {pathParts.length >= 1 && (
            <span style={{ marginLeft: 12, color: 'var(--muted)', fontSize: '0.82rem' }}>
              {pathParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && ' › '}
                  {part.length > 14 ? `${part.slice(0, 14)}…` : part}
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      <Routes>
        <Route index element={<RegionList />} />
        <Route path=":region" element={<SensorList />} />
        <Route path=":region/:eui" element={<SensorDetail />} />
      </Routes>
    </>
  );
}

export default Sensors;
