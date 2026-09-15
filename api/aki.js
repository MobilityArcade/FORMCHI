module.exports = async function handler(req,res){
 if(req.method==='OPTIONS'){res.setHeader('Allow','POST, OPTIONS');return res.status(204).end()}
 if(req.method!=='POST'){res.setHeader('Allow','POST, OPTIONS');return res.status(405).json({error:`AKI endpoint expected POST but received ${req.method}`})}
 if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
 try{
  let body=req.body;if(Buffer.isBuffer(body))body=body.toString('utf8');if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={sdp:body}}}
  const sdp=body&&typeof body.sdp==='string'?body.sdp:'';if(!sdp||!sdp.trim().startsWith('v=0'))return res.status(400).json({error:'Valid SDP offer required'});
  const requested=body&&typeof body.voice==='string'?body.voice:'marin';const voice=['marin','cedar'].includes(requested)?requested:'marin';
  const liveRequest={session:{model:'gpt-realtime-1.5',max_output_tokens:220,audio:{input:{turn_detection:{type:'server_vad',silence_duration_ms:350,prefix_padding_ms:250}},output:{voice}},instructions:`You are AKI, a warm, highly responsive voice presence. Conversation is the product. Speed and conversational immediacy are critical. Start speaking as soon as the user's turn is clearly complete. Give the useful conclusion first. Default to 1-3 short spoken sentences. For complex questions, do not silently deliberate for a long time: give a concise best answer or recommendation immediately, then offer one next detail or question. Expand only when the user explicitly asks for depth. Never pad with long acknowledgements, summaries, or preambles.

The user initiates by saying your name, "Aki." When they say "Aki" to begin or regain your attention, respond naturally and briefly: "I am here. How can I help you?" Do not introduce yourself or explain the product.

Listen carefully and have a genuine dialogue. Understand what is actually happening before trying to fix it. Infer the immediate need, constraint, and desired change. Help with the smallest useful next step. Ask only one useful question at a time when needed. Do not automatically suggest breathing, meditation, affirmations, journaling, or generic self-care. Do not sound clinical, corporate, preachy, or overly cheerful.

The interface can persist a feminine or masculine voice preference by reconnecting the Live session. If the user asks for a masculine/male voice or feminine/female voice, keep your spoken acknowledgement extremely brief because the interface may immediately reconnect to apply that preference.

If the user says stop, end, that's enough, or clearly asks to end, acknowledge briefly and stop speaking. For emergencies or high-stakes medical or safety situations, prioritize appropriate real-world help and do not pretend to diagnose or replace professionals.`},transport:{type:'webrtc',sdp}};
  const upstream=await fetch('https://api.openai.com/v1/live/sessions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(liveRequest)});
  const raw=await upstream.text();if(!upstream.ok){console.error('OpenAI Live error:',upstream.status,raw);res.status(upstream.status);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:raw||`OpenAI returned ${upstream.status}`}))}
  let data;try{data=JSON.parse(raw)}catch{return res.status(502).json({error:'OpenAI Live returned a non-JSON response'})}
  const answer=data?.transport?.sdp;if(!answer||typeof answer!=='string'||!answer.trim().startsWith('v=0'))return res.status(502).json({error:'OpenAI Live response did not include a valid SDP answer'});
  res.status(200);res.setHeader('Content-Type','application/sdp');res.setHeader('Cache-Control','no-store');return res.end(answer)
 }catch(error){console.error('AKI server error:',error);return res.status(500).json({error:error?.message||'Failed to create AKI Live session'})}
};
