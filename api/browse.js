export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({ok:false,error:'OPENAI_API_KEY is not configured'});
  try{
    const {url,context=''}=req.body||{};
    if(typeof url!=='string'||url.length>2048)return res.status(400).json({ok:false,error:'A valid website URL is required'});
    let parsed; try{parsed=new URL(url)}catch{return res.status(400).json({ok:false,error:'A valid website URL is required'})}
    if(!['http:','https:'].includes(parsed.protocol))return res.status(400).json({ok:false,error:'Only http/https websites are supported'});
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5.6-terra',
        tools:[{type:'web_search',search_context_size:'medium'}],
        tool_choice:'required',
        max_output_tokens:650,
        input:`The user deliberately pasted this website URL into AKI: ${parsed.href}\n${context?`Their surrounding text was: ${String(context).slice(0,1200)}\n`:''}Use web search to access/read information from this specific URL or its website. Give a concise grounded account of what the page/site says that is useful for continuing a voice conversation. Prefer the pasted page itself over unrelated search results. Clearly say if the exact page is inaccessible, blocked, paywalled, login-only, dynamically unreadable, or if you could only verify related search information. Never invent page contents.`
      })
    });
    const raw=await r.text();
    if(!r.ok){console.error('AKI 7.1.6.2 browse API error',r.status,raw.slice(0,1200));return res.status(r.status).json({ok:false,error:'Website reading failed'})}
    const out=JSON.parse(raw);
    const observation=(out.output_text||out.output?.flatMap?.(o=>o.content||[]).find?.(c=>c.type==='output_text')?.text||'').trim();
    if(!observation)return res.status(502).json({ok:false,error:'No verified website result was returned'});
    return res.status(200).json({ok:true,observation});
  }catch(err){console.error('AKI 7.1.6.2 browse server error',err);return res.status(500).json({ok:false,error:'Unable to read website'})}
}
