export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
  try{
    const {images=[],prompt='Describe what is visibly relevant in the image.'}=req.body||{};
    if(!Array.isArray(images)||!images.length) return res.status(400).json({error:'No image supplied'});
    const content=[{type:'input_text',text:String(prompt).slice(0,1500)}];
    for(const image_url of images.slice(0,2)){
      if(typeof image_url==='string' && image_url.startsWith('data:image/')) content.push({type:'input_image',image_url});
    }
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'user',content}],max_output_tokens:350})
    });
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||'Vision request failed'});
    const text=data.output_text || (data.output||[]).flatMap(o=>o.content||[]).map(c=>c.text||'').join('').trim();
    return res.status(200).json({text});
  }catch(err){return res.status(500).json({error:err?.message||'Vision request failed'})}
}
