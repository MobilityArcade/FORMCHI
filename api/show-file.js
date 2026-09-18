export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({ok:false,error:'OPENAI_API_KEY is not configured'});
  try{
    const {filename,mime,data}=req.body||{};
    if(typeof filename!=='string'||!filename.trim()||typeof data!=='string'||!data.length)return res.status(400).json({ok:false,error:'A valid file is required'});
    if(data.length>4_100_000)return res.status(413).json({ok:false,error:'File is too large for this web handoff'});
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5.6-terra',max_output_tokens:500,
        input:[{role:'user',content:[
          {type:'input_text',text:`Read the exact user-selected file named "${filename}". Give a concise, grounded description of what the file contains and its most important content so a voice assistant can continue discussing it with the user. Do not invent missing content. If the file cannot actually be read, say so clearly.`},
          {type:'input_file',filename:filename,file_data:data}
        ]}]
      })
    });
    const raw=await r.text();
    if(!r.ok){console.error('AKI 7.1.6.2 file API error',r.status,raw.slice(0,1200));return res.status(r.status).json({ok:false,error:r.status===413?'That file is too large for this web handoff right now.':'AKI received the file, but could not reliably read that file type or content.'});}
    const out=JSON.parse(raw);
    const observation=(out.output_text||out.output?.flatMap?.(o=>o.content||[]).find?.(c=>c.type==='output_text')?.text||'').trim();
    if(!observation)return res.status(502).json({ok:false,error:'No verified file observation was returned'});
    return res.status(200).json({ok:true,observation});
  }catch(err){console.error('AKI 7.1.6.2 file server error',err);return res.status(500).json({ok:false,error:'Unable to analyze file'});}
}
