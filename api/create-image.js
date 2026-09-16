export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'A prompt is required' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'jpeg'
      })
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('AKI image API:', data);
      return res.status(r.status).json({ error: data?.error?.message || 'Image generation failed' });
    }

    const item = data?.data?.[0];
    if (item?.b64_json) {
      return res.status(200).json({ image: `data:image/jpeg;base64,${item.b64_json}` });
    }
    if (item?.url) return res.status(200).json({ image: item.url });

    return res.status(502).json({ error: 'Image generation returned no image' });
  } catch (err) {
    console.error('AKI create-image route:', err);
    return res.status(500).json({ error: 'Image generation request failed' });
  }
}
