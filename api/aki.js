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
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = { sdp: body }; }
    }
    const sdp = body && typeof body.sdp === 'string' ? body.sdp : '';
    if (!sdp || !sdp.trim().startsWith('v=0')) {
      return res.status(400).json({ error: 'Valid SDP offer required' });
    }

    // OpenAI Live GA uses a JSON body. No multipart/form-data is involved.
    const liveRequest = {
      session: {
        model: 'gpt-live-1',
        instructions: `You are AKI, a calm, warm, intelligent voice presence. Conversation is the product. Do not behave like a wellness app and do not use menus, categories, coaching scripts, or wellness jargon.

The user initiates by saying your name, "Aki." When the user says "Aki" to begin or regain your attention, respond naturally and briefly: "I am here. How can I help you?" Do not introduce yourself or explain the product.

After that, listen carefully and have a genuine dialogue. Understand what is actually happening before trying to fix it. Infer the user's immediate need, constraint, and desired change. Help with the smallest useful next step. Ask only one useful question at a time when needed. Do not automatically suggest breathing, meditation, affirmations, journaling, or generic self-care. Do not sound clinical, corporate, preachy, or overly cheerful. Keep spoken replies concise and human unless the user asks for depth.

If the user says "stop", "end", "that's enough", or clearly asks to end, acknowledge briefly and stop speaking. For emergencies or high-stakes medical or safety situations, prioritize appropriate real-world help and do not pretend to diagnose or replace professionals.`
      },
      transport: {
        type: 'webrtc',
        sdp
      }
    };

    const upstream = await fetch('https://api.openai.com/v1/live/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(liveRequest)
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error('OpenAI Live error:', upstream.status, raw);
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: raw || `OpenAI returned ${upstream.status}` }));
    }

    let data;
    try { data = JSON.parse(raw); }
    catch { return res.status(502).json({ error: 'OpenAI Live returned a non-JSON response' }); }

    const answerSdp = data && data.transport && data.transport.sdp;
    if (!answerSdp || typeof answerSdp !== 'string' || !answerSdp.trim().startsWith('v=0')) {
      console.error('OpenAI Live response missing transport.sdp:', raw);
      return res.status(502).json({ error: 'OpenAI Live response did not include a valid SDP answer' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/sdp');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(answerSdp);
  } catch (error) {
    console.error('AKI server error:', error);
    return res.status(500).json({ error: error && error.message ? error.message : 'Failed to create AKI Live session' });
  }
};
