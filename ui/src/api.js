const BASE = '/api';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `GET ${path} failed (${res.status})`);
  }
  return res.json();
}

// ── Regions ────────────────────────────────────────────────────────
/** GET /api/regions → { count: number, regions: string[] } */
export function fetchRegions() {
  return get('/regions');
}

// ── Device EUIs ────────────────────────────────────────────────────
/** GET /api/deviceeuis → { count: number, deviceEuis: string[] } */
export function fetchDeviceEUIs() {
  return get('/deviceeuis');
}

// ── Door IDs ───────────────────────────────────────────────────────
/** GET /api/doorids → { count: number, doorIds: string[] } */
export function fetchDoorIDs() {
  return get('/doorids');
}

// ── Recent entries ──────────────────────────────────────────────────
/** GET /api/recent → { entries: object[] } — last 5 data points */
export function fetchRecent() {
  return get('/recent');
}

// ── Hourly stats ────────────────────────────────────────────────────
/** GET /api/stats → { entriesPerHour, estimated, uplinks, downlinks } */
export function fetchStats() {
  return get('/stats');
}

// ── Sensors by region ───────────────────────────────────────────────
/** GET /api/sensors?region=X → { region, sensors: [{deviceEui, latestTime}], count } */
export function fetchSensorsByRegion(region) {
  return get(`/sensors?region=${encodeURIComponent(region)}`);
}

// ── Sensor detail ───────────────────────────────────────────────────
/** GET /api/sensor/:eui → { deviceEui, region, uplinks, downlinks, latestRssi, latestSnr, entries[] } */
export function fetchSensorDetail(eui) {
  return get(`/sensor/${encodeURIComponent(eui)}`);
}
