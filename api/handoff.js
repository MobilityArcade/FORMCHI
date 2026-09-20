export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({ok:false,error:'OPENAI_API_KEY is not configured'});
  try{
    const {request='',context=[]}=req.body||{};
    if(typeof request!=='string'||!request.trim())return res.status(400).json({ok:false,error:'Request required'});
    const safeContext=Array.isArray(context)?context.slice(-10).map(x=>`${x?.role==='assistant'?'AKI':'USER'}: ${String(x?.text||'').slice(0,500)}`).join('\n'):'';
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5.6-terra',max_output_tokens:120,
        input:`Resolve one explicit AKI handoff request into a short Google-search query. Use conversation context only to resolve references such as "that book" or "that product". Do NOT include private/internal thoughts, explanations, markdown, URLs, commentary, or conversational filler. Return exactly two lines:\nLABEL: <short human-readable item, max 80 chars>\nQUERY: <precise search query, max 180 chars>\nIf the referenced item cannot be identified from context, use the user's literal requested subject rather than inventing a specific item.\n\nCONTEXT:\n${safeContext}\n\nCURRENT REQUEST:\n${request.slice(0,600)}`
      })
    });
    const raw=await r.text();if(!r.ok){console.error('AKI 10.5.1 handoff API error',r.status,raw.slice(0,800));return res.status(r.status).json({ok:false,error:'Handoff resolution failed'})}
    const out=JSON.parse(raw);const text=String(out.output_text||out.output?.flatMap?.(o=>o.content||[]).find?.(c=>c.type==='output_text')?.text||'').trim();
    const label=(text.match(/^LABEL:\s*(.+)$/mi)||[])[1]?.trim();const query=(text.match(/^QUERY:\s*(.+)$/mi)||[])[1]?.trim();
    if(!query)return res.status(502).json({ok:false,error:'No clean handoff query returned'});
    return res.status(200).json({ok:true,label:(label||query).slice(0,80),query:query.slice(0,180)});
  }catch(err){console.error('AKI 10.5.1 handoff server error',err);return res.status(500).json({ok:false,error:'Unable to create handoff'})}
}
