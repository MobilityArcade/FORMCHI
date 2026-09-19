export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok:false, error:'OPENAI_API_KEY is not configured' });

  try {
    const { image } = req.body || {};
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ ok:false, error:'A valid image is required' });
    }
    // Keep the endpoint intentionally narrow. The browser already downsizes to
    // 1600px; this protects the server from accidental oversized payloads.
    if (image.length > 9_000_000) return res.status(413).json({ ok:false, error:'Image is too large' });

    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        model:'gpt-5.6-terra',
        max_output_tokens:180,
        input:[{
          role:'user',
          content:[
            {type:'input_text',text:'Inspect this exact user-selected image. Return a concise, concrete visual observation suitable for a voice assistant. State only what is visibly supported. Do not mention policies, image processing, or speculate about identity, intent, hidden context, or anything not visible.'},
            {type:'input_image',image_url:image,detail:'auto'}
          ]
        }]
      })
    });

    const raw = await r.text();
    if (!r.ok) {
      console.error('AKI 7.1.3.1 Show Me API error', r.status, raw.slice(0,1000));
      return res.status(r.status).json({ ok:false, error:'Image analysis failed' });
    }
    const data=JSON.parse(raw);
    const observation=(data.output_text || data.output?.flatMap?.(o=>o.content||[]).find?.(c=>c.type==='output_text')?.text || '').trim();
    if(!observation) return res.status(502).json({ ok:false, error:'No verified image observation was returned' });
    return res.status(200).json({ok:true,observation});
  } catch (err) {
    console.error('AKI 7.1.3.1 Show Me server error', err);
    return res.status(500).json({ok:false,error:'Unable to analyze image'});
  }
}
