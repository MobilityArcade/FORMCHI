export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'marin',
        input: 'Hello, how can I help you?',
        instructions: 'Speak naturally, warmly, calmly, and clearly. Do not add, remove, or change any words.',
        response_format: 'mp3',
        speed: 1.0
      })
    });
    if (!r.ok) return res.status(r.status).send(await r.text());
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(audio);
  } catch (err) {
    console.error('AKI Marin greeting error', err);
    return res.status(500).json({ error: err?.message || 'Unable to create greeting audio' });
  }
}
