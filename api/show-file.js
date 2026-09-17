export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({ok:false,error:'OPENAI_API_KEY is not configured'});
  try{
    const {file,filename='shared-file',mime='application/octet-stream'}=req.body||{};
    if(typeof file!=='string'||!file.startsWith('data:'))return res.status(400).json({ok:false,error:'A valid file is required'});
    if(file.length>17_000_000)return res.status(413).json({ok:false,error:'File is too large'});
    const allowed=/^(application\/pdf|text\/|application\/(json|xml|rtf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet)))/i.test(mime);
    if(!allowed)return res.status(415).json({ok:false,error:'This file type is not supported in this experiment'});
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-5.6-terra',max_output_tokens:220,input:[{role:'user',content:[
        {type:'input_text',text:'Inspect this exact user-selected file. Return a concise grounded summary of what the file contains, suitable for a voice assistant. Do not invent missing content.'},
        {type:'input_file',filename,file_data:file}
      ]}]})
    });
    const raw=await r.text();
    if(!r.ok){console.error('AKI 7.1.4 file API error',r.status,raw.slice(0,1000));return res.status(r.status).json({ok:false,error:'File analysis failed'})}
    const data=JSON.parse(raw);
    const observation=(data.output_text||data.output?.flatMap?.(o=>o.content||[]).find?.(c=>c.type==='output_text')?.text||'').trim();
    if(!observation)return res.status(502).json({ok:false,error:'No verified file result was returned'});
    return res.status(200).json({ok:true,observation});
  }catch(err){console.error('AKI 7.1.4 file server error',err);return res.status(500).json({ok:false,error:'Unable to analyze file'})}
}
