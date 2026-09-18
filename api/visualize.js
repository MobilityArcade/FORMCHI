export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
  try{
    const image=String(req.body?.image||'');
    const instruction=String(req.body?.instruction||'').trim();
    const observation=String(req.body?.observation||'').trim();
    if(!image.startsWith('data:image/'))return res.status(400).json({error:'A source image is required'});
    if(!instruction)return res.status(400).json({error:'A visualization instruction is required'});
    if(image.length>9_000_000)return res.status(413).json({error:'Source image is too large'});
    const prompt=`Edit the supplied source image to visualize the user's requested change. Preserve the original scene, geometry, perspective, composition, architecture, objects, lighting, and all unaffected details as faithfully as possible. Change only what the user requests. This is a visualization/mockup, not a claim that the result is physically exact.\nUSER REQUEST: ${instruction}\n${observation?`VERIFIED SOURCE OBSERVATION: ${observation}`:''}`;
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5.6-terra',
        input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image}]}],
        tools:[{type:'image_generation',model:'gpt-image-2',action:'edit',quality:'medium',size:'auto',output_format:'png'}],
        tool_choice:{type:'image_generation'}
      })
    });
    const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Image generation request failed');
    const call=(data.output||[]).find(x=>x.type==='image_generation_call');
    const b64=call?.result;
    if(!b64)throw new Error('No generated image was returned');
    return res.status(200).json({ok:true,image:`data:image/png;base64,${b64}`});
  }catch(err){console.error('AKI 8.0 Visualize error',err);return res.status(500).json({error:err?.message||'Unable to create visualization'})}
}
