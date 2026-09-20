// AKI 10.5.8 — private aggregate analytics endpoint.
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const pin=process.env.AKI_ANALYTICS_PIN;
  if(!pin || String(req.body?.pin||'')!==pin) return res.status(401).json({error:'Unauthorized'});
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) return res.status(503).json({error:'Database not configured'});
  try{
    const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/aki_usage?event=eq.stop&select=session_id,device_id,version,started_at,ended_at,duration_seconds&order=ended_at.desc&limit=10000`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if(!r.ok) throw new Error(`Supabase read failed ${r.status}: ${await r.text()}`);
    const rows=await r.json(), now=Date.now(), day=86400000;
    const sumSince=(ms)=>rows.filter(x=>Date.parse(x.ended_at)>=now-ms).reduce((a,x)=>a+(Number(x.duration_seconds)||0),0);
    const total=rows.reduce((a,x)=>a+(Number(x.duration_seconds)||0),0);
    const devices={}; for(const x of rows){const d=devices[x.device_id]||(devices[x.device_id]={seconds:0,sessions:0});d.seconds+=Number(x.duration_seconds)||0;d.sessions++}
    return res.status(200).json({today_seconds:sumSince(day),seven_day_seconds:sumSince(7*day),thirty_day_seconds:sumSince(30*day),total_seconds:total,sessions:rows.length,devices:Object.keys(devices).length,average_session_seconds:rows.length?Math.round(total/rows.length):0,by_device:Object.entries(devices).map(([device_id,v])=>({device_id:device_id.slice(0,8),...v})).sort((a,b)=>b.seconds-a.seconds)});
  }catch(e){console.error('AKI analytics summary error',e);return res.status(500).json({error:'Unable to load analytics'})}
}
