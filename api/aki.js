module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: `AKI endpoint expected POST but received ${req.method}` });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  }

  try {
    // The browser sends JSON so Vercel's request parser can preserve the SDP reliably.
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = { sdp: body }; }
    }
    const sdp = body && typeof body.sdp === 'string' ? body.sdp : '';

    if (!sdp || !sdp.trim().startsWith('v=0')) {
      return res.status(400).json({ error: 'Valid SDP offer required' });
    }

    const session = {
      type: 'realtime',
      model: 'gpt-realtime-2.1',
      output_modalities: ['audio'],
      audio: { output: { voice: 'marin' } },
      instructions: `You are AKI, a calm, warm, intelligent voice presence. Conversation is the product. Do not behave like a wellness app and do not use menus, categories, coaching scripts, or wellness jargon.

The user's invocation is your name: "Aki." When the user says "Aki" to begin or regain your attention, respond naturally and briefly: "I am here. How can I help you?" Do not introduce yourself or explain the product.

After that, listen carefully and have a genuine dialogue. Understand what is actually happening before trying to fix it. Infer the user's immediate need, constraint, and desired change. Help with the smallest useful next step. Ask only one useful question at a time when needed. Do not automatically suggest breathing, meditation, affirmations, journaling, or generic self-care. Do not sound clinical, corporate, preachy, or overly cheerful. Keep spoken replies concise and human unless the user asks for depth.

If the user says "stop", "end", "that's enough", or clearly asks to end, acknowledge briefly and stop speaking. For emergencies or high-stakes medical or safety situations, prioritize appropriate real-world help and do not pretend to diagnose or replace professionals.`,
      max_output_tokens: 500
    };

    const form = new FormData();
    form.append('sdp', new Blob([sdp], { type: 'application/sdp' }), 'offer.sdp');
    form.append('session', new Blob([JSON.stringify(session)], { type: 'application/json' }), 'session.json');

    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });

    const answer = await upstream.text();
    if (!upstream.ok) {
      console.error('OpenAI Realtime error:', upstream.status, answer);
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: answer || `OpenAI returned ${upstream.status}` }));
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/sdp');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(answer);
  } catch (error) {
    console.error('AKI server error:', error);
    return res.status(500).json({ error: error && error.message ? error.message : 'Failed to create AKI Realtime call' });
  }
};
