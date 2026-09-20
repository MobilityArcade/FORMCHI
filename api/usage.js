// AKI 10.5.8 — anonymous persistent usage analytics.
// Stores timing metadata only. Never stores transcript, audio, prompts, or responses.
function cleanRecord(b) {
  const event = b.event === 'start' ? 'start' : b.event === 'stop' ? 'stop' : null;
  if (!event || typeof b.session_id !== 'string' || typeof b.device_id !== 'string') return null;
  return {
    event,
    session_id: b.session_id.slice(0, 100),
    device_id: b.device_id.slice(0, 100),
    version: String(b.version || '10.5.8').slice(0, 30),
    started_at: b.started_at || null,
    ended_at: b.ended_at || null,
    duration_seconds: event === 'stop' ? Math.max(0, Math.min(Number(b.duration_seconds) || 0, 86400)) : null
  };
}
async function persist(record) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { stored: false, reason: 'database_not_configured' };
  const r = await fetch(`${url.replace(/\/$/,'')}/rest/v1/aki_usage`, {
    method: 'POST',
    headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(record)
  });
  if (!r.ok) throw new Error(`Supabase insert failed ${r.status}: ${await r.text()}`);
  return { stored: true };
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  try {
    const record = cleanRecord(req.body || {});
    if (!record) return res.status(400).json({ error:'Invalid usage event' });
    console.log(JSON.stringify({type:'aki_usage', ...record}));
    let storage;
    try { storage = await persist(record); }
    catch (e) { console.error('AKI persistent usage storage error', e); storage={stored:false,reason:'storage_error'}; }
    return res.status(200).json({ ok:true, ...storage });
  } catch (err) {
    console.error('AKI usage meter error', err);
    return res.status(500).json({ error:'Unable to record usage' });
  }
}
