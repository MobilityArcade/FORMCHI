export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const { sdp, voice = 'marin', language = 'auto' } = req.body || {};
    if (!sdp || typeof sdp !== 'string' || !sdp.trim().startsWith('v=0')) {
      return res.status(400).json({ error: 'Valid SDP offer required' });
    }

    const allowedVoices = new Set(['marin','ash','cedar','alloy','ballad','coral','echo','sage','shimmer','verse']);
    const selectedVoice = allowedVoices.has(voice) ? voice : 'marin';

    const liveInstructions = `You are AKI, a calm, warm, intelligent voice presence. Be concise and conversational. Begin quickly; default to 1–3 short spoken sentences. When the human gets complicated, become simpler: choose one important thread or one useful next step. Ask only one useful question at a time. Do not use generic wellness scripts. If the user says “Aki” to begin or regain attention, say “I am here. How can I help you?” Follow the user's spoken language naturally (${language === 'auto' ? 'automatically' : language}). If the user asks to use the camera, look, see something, or send/show a photo, cooperate naturally. When delegated visual information is returned, speak about what is actually visible and never claim continuous vision beyond the supplied frame or photo.`;

    const backendInstructions = `You are AKI's visual and reasoning backend. When an image is supplied, inspect it carefully and answer the user's immediate visual question using only what is actually visible. Be concise. Never claim continuous camera access or details outside the supplied image. If the image is unclear, say what is uncertain. Return an answer suitable for AKI to speak aloud.`;

    const body = {
      session: {
        model: 'gpt-live-1',
        audio: { output: { voice: selectedVoice } },
        instructions: liveInstructions,
        delegation: {
          type: 'responses',
          responses: {
            model: 'gpt-5.6-terra',
            instructions: backendInstructions,
            max_output_tokens: 220
          }
        }
      },
      transport: { type: 'webrtc', sdp }
    };

    const r = await fetch('https://api.openai.com/v1/live/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).send(text);
    const data = JSON.parse(text);
    const answer = data?.transport?.sdp;
    if (!answer) return res.status(502).json({ error: 'Live session returned no SDP answer' });
    res.setHeader('Content-Type', 'application/sdp');
    return res.status(200).send(answer);
  } catch (err) {
    console.error('AKI 5.2 session error', err);
    return res.status(500).json({ error: err?.message || 'Unable to create AKI Live session' });
  }
}
