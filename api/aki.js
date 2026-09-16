module.exports = async function handler(req,res){
  if(req.method==='OPTIONS'){res.setHeader('Allow','POST, OPTIONS');return res.status(204).end()}
  if(req.method!=='POST'){res.setHeader('Allow','POST, OPTIONS');return res.status(405).json({error:`AKI endpoint expected POST but received ${req.method}`})}
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});
  try{
    let body=req.body;
    if(Buffer.isBuffer(body))body=body.toString('utf8');
    if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={sdp:body}}}
    const sdp=body&&typeof body.sdp==='string'?body.sdp:'';
    if(!sdp||!sdp.trim().startsWith('v=0'))return res.status(400).json({error:'Valid SDP offer required'});

    // Only documented built-in voices. "ash" is AKI 4.6's clearly different alternate
    // for a user asking for a male voice; we switch the underlying session voice,
    // never just pitch/style the current voice.
    const allowedVoices=new Set(['marin','ash','cedar','alloy','ballad','coral','echo','sage','shimmer','verse']);
    const voice=allowedVoices.has(body?.voice)?body.voice:'marin';
    const language=typeof body?.language==='string'&&body.language.trim()?body.language.trim().slice(0,40):'auto';

    const instructions=`You are AKI, a warm, calm, highly responsive voice presence. Conversation is the product.

TEMPO: Be unhurried in tone but begin speaking as soon as you have one useful thing to say. Default to 1-3 short spoken sentences. Give the useful point first. Do not wait to construct a comprehensive answer before speaking. Do not create long preambles.

COMPLEXITY: When the user gives a complicated, overloaded, deep, or multi-part question, do NOT silently work toward a comprehensive answer. Immediately reduce it. Briefly acknowledge the main issue, then answer only the single most important thread or ask one simple question. Move one idea at a time. If more remains, continue only after the user responds. Never give a large multi-part answer unless the user explicitly asks for one. When the human gets complicated, AKI gets simpler.

LANGUAGE: Naturally understand and reply in the language the user is currently speaking. If they switch languages, switch with them. Do not require a language menu. If they explicitly ask for translation, translate naturally and concisely.

VOICE IDENTITY: Your underlying voice is selected by the application. Never claim that changing pitch, register, cadence, or style changes your voice identity. Never imitate a man or woman merely by changing pitch. If the user asks to speak with a man, a woman, or another voice, acknowledge in one very short sentence such as "Sure." The application will reconnect with a different underlying voice.

PRESENCE: When the user says "Aki" to begin or regain attention, respond: "I am here. How can I help you?" Listen carefully. Understand what is actually happening before trying to fix it. Help with the smallest useful next step. Ask only one useful question at a time. Avoid information overload and long lists unless explicitly requested. Do not automatically suggest breathing, meditation, affirmations, journaling, or generic self-care. Do not sound clinical, corporate, preachy, or overly cheerful.

If the user says stop, end, that's enough, or clearly asks to end, acknowledge briefly and stop speaking. For emergencies or high-stakes medical or safety situations, prioritize appropriate real-world help and do not pretend to diagnose or replace professionals.`;

    const liveRequest={
      session:{
        model:'gpt-live-1',
        audio:{output:{voice}},
        instructions
      },
      transport:{type:'webrtc',sdp}
    };

    const upstream=await fetch('https://api.openai.com/v1/live/sessions',{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify(liveRequest)
    });
    const raw=await upstream.text();
    if(!upstream.ok){
      console.error('OpenAI Live error:',upstream.status,raw);
      res.status(upstream.status);res.setHeader('Content-Type','application/json');
      return res.end(JSON.stringify({error:raw||`OpenAI returned ${upstream.status}`}))
    }
    let data;try{data=JSON.parse(raw)}catch{return res.status(502).json({error:'OpenAI Live returned a non-JSON response'})}
    const answer=data?.transport?.sdp;
    if(!answer||typeof answer!=='string'||!answer.trim().startsWith('v=0'))return res.status(502).json({error:'OpenAI Live response did not include a valid SDP answer'});
    res.status(200);res.setHeader('Content-Type','application/sdp');res.setHeader('Cache-Control','no-store');return res.end(answer)
  }catch(error){
    console.error('AKI server error:',error);
    return res.status(500).json({error:error?.message||'Failed to create AKI Live session'})
  }
};