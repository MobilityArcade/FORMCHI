export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
  try{
    const conversation=String(req.body?.conversation||'').trim();
    if(!conversation)return res.status(400).json({error:'Conversation context required'});
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5.6-terra',
        input:`Create one compact AKI Keep from this recent conversation. A Keep is text-only continuity: meaning, decisions, ideas, important specifics, and where the person left off. Never claim to store images, files, audio, or transcripts. Return ONLY valid JSON with exactly two strings: {"title":"short memorable title","summary":"concise continuation-ready memory, maximum 110 words"}. Preserve concrete names, decisions, creative details, materials, lyrics/chords only if actually present. Do not invent missing details.\n\nRECENT CONVERSATION:\n${conversation.slice(-12000)}`,
        max_output_tokens:260
      })
    });
    const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Keep model request failed');
    const raw=String(data.output_text||data.output?.flatMap?.(x=>x.content||[])?.find?.(x=>x.type==='output_text')?.text||'').trim();
    let parsed;try{parsed=JSON.parse(raw.replace(/^```json\s*|\s*```$/g,''))}catch{throw new Error('Keep summary was not valid JSON')}
    const title=String(parsed.title||'').trim().slice(0,80),summary=String(parsed.summary||'').trim().slice(0,1200);
    if(!title||!summary)throw new Error('Keep summary was incomplete');
    return res.status(200).json({ok:true,keep:{title,summary}});
  }catch(err){console.error('AKI 8.0 Keep error',err);return res.status(500).json({error:err?.message||'Unable to create Keep'})}
}
