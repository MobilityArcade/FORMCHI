export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
  try{
    const conversation=Array.isArray(req.body?.conversation)?req.body.conversation.slice(-24):[];
    if(!conversation.length)return res.status(400).json({error:'No conversation available'});
    const transcript=conversation.map(x=>`${x.role==='aki'?'AKI':'USER'}: ${String(x.text||'').slice(0,1800)}`).join('\n');
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-terra',instructions:'Create a concise personal note from the supplied conversation. Preserve the useful idea, decision, plan, names, and concrete next steps. Do not mention that you are an AI. Do not add facts that were not in the conversation. Return only the note text, with a short title on the first line and compact bullets or short paragraphs after it. Keep it easy to copy into Apple Notes.',input:transcript,max_output_tokens:350})});
    const data=await r.json();
    if(!r.ok)throw new Error(data?.error?.message||'Note generation failed');
    const text=(data.output_text||data.output?.flatMap?.(o=>o.content||[]).map?.(c=>c.text||'').join('\n')||'').trim();
    if(!text)throw new Error('No note text returned');
    res.status(200).json({ok:true,note:text});
  }catch(err){console.error('AKI 10.2 note error',err);res.status(500).json({error:err?.message||'Unable to create note'});}
}
