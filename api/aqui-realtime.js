import { createHash, timingSafeEqual } from 'node:crypto';

// Raw streaming allows a strict bound before parsing. Existing routes are unaffected.
export const config = { api: { bodyParser: false }, maxDuration: 30 };
const MAX_BYTES = 64 * 1024;

// Replace this boundary with production caller authentication later.
function authenticate(header, expected) {
  if (typeof header !== 'string' || header.length > 256) return false;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
  if (!match) return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(match[1]), hash(expected));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (status, error) => res.status(status).json({ error });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(405, 'Method not allowed');
  }
  const token = process.env.AQUI_NATIVE_DEV_TOKEN;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return fail(503, 'Native voice is not configured');
  }
  if (!authenticate(req.headers.authorization, token)) return fail(401, 'Unauthorized');
  if (!process.env.AQUI_NATIVE_OPENAI_API_KEY) return fail(503, 'Native voice is not configured');
  if (!/^application\/sdp(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) {
    return fail(415, 'Expected application/sdp');
  }
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) {
    return fail(413, 'Request too large');
  }
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    return fail(415, 'Compressed requests are not supported');
  }
  let sdp;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BYTES) return fail(413, 'Request too large');
      chunks.push(bytes);
    }
    sdp = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return fail(400, 'Invalid request body');
  }
  // Structural checks only; OpenAI performs full SDP negotiation validation.
  if (!/^v=0\r?\n/.test(sdp) || !/^m=audio /m.test(sdp) ||
      !/^a=fingerprint:/m.test(sdp) || /\x00/.test(sdp) || /^m=video /m.test(sdp)) {
    return fail(400, 'Valid audio WebRTC SDP offer required');
  }
  const form = new FormData();
  form.set('sdp', sdp);
  form.set('session', JSON.stringify({
    type: 'realtime',
    model: 'gpt-realtime-2.1',
    output_modalities: ['audio'],
    audio: { output: { voice: 'marin' } },
    max_output_tokens: 500,
    instructions: 'You are AQUI, a calm, warm conversational assistant. Be concise and listen carefully. The native app has already played its startup greeting. Do not greet, introduce yourself, or speak unsolicited when connecting. Respond when the user speaks. This native version supports voice conversation only; do not claim camera, file, browsing, or device-control capabilities.'
  }));
  try {
    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AQUI_NATIVE_OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
      redirect: 'error'
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      if (upstream.status === 429) return fail(429, 'Voice service is busy; try again later');
      return fail(502, 'Unable to establish voice session');
    }
    const answer = await upstream.text();
    if (!/^v=0\r?\n/.test(answer) || Buffer.byteLength(answer) > MAX_BYTES) {
      return fail(502, 'Invalid voice session response');
    }
    res.setHeader('Content-Type', 'application/sdp');
    return res.status(200).send(answer);
  } catch (error) {
    return fail(error?.name === 'TimeoutError' ? 504 : 502, 'Unable to establish voice session');
  }
}
