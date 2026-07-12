// formatTime converts an InfluxDB nanosecond timestamp to a readable
// local time string.
export function formatTime(ns) {
  if (ns == null) return '—';
  const ms = Number(ns) / 1e6; // ns → ms
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
