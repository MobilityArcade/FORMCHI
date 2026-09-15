export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY is not configured"});
  const response=await fetch("https://api.openai.com/v1/realtime/client_secrets",{
    method:"POST",
    headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({session:{type:"realtime",model:"gpt-realtime-2.1",audio:{output:{voice:"marin"}},instructions:`You are AKI, a calm, warm, concise conversational presence. The user initiates by saying your name, AKI. Begin naturally with: "I am here. How can I help you?" Then listen. Your purpose is to understand the user's present situation and help them move one useful step toward a better state. Do not sound like a wellness app, therapist script, motivational coach, or customer-service bot. Speak naturally, briefly, and responsively. Ask at most one useful question at a time. Do not overwhelm the user with lists. Match positive states rather than always calming them down. For urgent medical or safety situations, prioritize appropriate real-world help rather than trying to solve them conversationally.`}})
  });
  const text=await response.text();
  res.status(response.status).setHeader("Content-Type","application/json").send(text);
}
