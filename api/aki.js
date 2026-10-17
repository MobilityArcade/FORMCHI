// Optional Vercel serverless endpoint. Keep OPENAI_API_KEY in server environment variables only.
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI not configured'});
 const {mode,language,duration}=req.body||{};
 if(!['dance','stretch','flow','play'].includes(mode)||!['en','es'].includes(language)||![30,60,180].includes(Number(duration)))return res.status(400).json({error:'Invalid settings'});
 const step=mode==='stretch'?8:mode==='flow'?6:4;
 const count=Math.ceil(duration/step);
 const instruction=`Create ${count} short, varied, safe movement cues for a ${mode} game, in ${language==='es'?'Spanish':'English'}. Use concise imperative action words (1-3 words), energetic for dance/play and gentle for stretch/flow. No dangerous moves, inversions, jumps, or fast spins. No explanations. Return ONLY JSON: {"cues":[{"at":0,"word":"SHAKE!","spoken":"Shake!"}]} with timestamps at exactly 0, ${step}, ${step*2}, ... strictly below ${duration}. Every word <= 30 characters.`;
 try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',input:instruction,max_output_tokens:1800})});const raw=await r.json();if(!r.ok)return res.status(502).json({error:'AI service error'});const text=(raw.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');const match=text.match(/\{[\s\S]*\}/);if(!match)throw Error('Missing JSON');const parsed=JSON.parse(match[0]);if(!Array.isArray(parsed.cues))throw Error('Missing cues');const cues=parsed.cues.filter(c=>Number.isFinite(c.at)&&c.at>=0&&c.at<duration&&typeof c.word==='string'&&c.word.length<=38).slice(0,65);if(!cues.length)throw Error('Empty cues');res.setHeader('Cache-Control','no-store');return res.status(200).json({cues})}catch{return res.status(502).json({error:'Could not generate movement cues'})}
}
