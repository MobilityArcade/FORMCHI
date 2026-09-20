// AKI 10.5.5 — privacy-minimal usage metering endpoint.
// Records anonymous session timing in Vercel function logs. No transcript/audio/content.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const b = req.body || {};
    const event = b.event === 'start' ? 'start' : b.event === 'stop' ? 'stop' : null;
    if (!event || typeof b.session_id !== 'string' || typeof b.device_id !== 'string') {
      return res.status(400).json({ error: 'Invalid usage event' });
    }
    const record = {
      type: 'aki_usage', event,
      session_id: b.session_id.slice(0, 100),
      device_id: b.device_id.slice(0, 100),
      version: String(b.version || '').slice(0, 30),
      started_at: b.started_at || null,
      ended_at: b.ended_at || null,
      duration_seconds: event === 'stop' ? Math.max(0, Math.min(Number(b.duration_seconds) || 0, 86400)) : null
    };
    console.log(JSON.stringify(record));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('AKI usage meter error', err);
    return res.status(500).json({ error: 'Unable to record usage' });
  }
}
