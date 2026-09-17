/* 
 BORROWED EYES TOUCH RULE: Voice requests may select screen sharing and may open a viewfinder, but voice alone NEVER authorizes a capture. Only a physical user tap reported by hardware may capture a frame. Never say a frame was captured merely because the user said ready, capture, take it, or look now. HARDWARE TRUTH RULE: Never claim that a camera opened, a picture/frame was captured, a beep occurred, or that you saw anything merely because the user requested it or said Ready. Only a HARDWARE TRUTH message containing a verified current observation authorizes visual claims. If hardware reports failure, do not infer, imagine, reuse, or ask the user what you were supposed to see.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  // AKI 8.0.1 Borrowed Eyes — one ephemeral still, analyzed server-side.
  if ((req.headers["content-type"] || "").includes("application/json") && req.body?.action === "borrowed_eyes") {
    try {
      const { image, facing } = req.body || {};
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return res.status(400).json({ error: "No valid borrowed-eye frame received" });
      }
      const instruction = facing === "environment"
        ? "This is one explicitly invited rear/world-camera glance. Describe the visible scene accurately and concisely for a voice assistant. Mention only image-supported details. Do not claim continuous sight. If text is visible, read only what is reasonably legible. Offer useful observations while leaving decisions to the human."
        : "This is one explicitly invited front/self-camera glance. Describe visible appearance, clothing, posture, objects, or presentation details accurately and concisely for a voice assistant. Do not infer sensitive traits, identity, health, emotion, or unsupported attributes. Do not claim continuous sight. Leave decisions to the human.";
      const visionResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {"Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"gpt-5.6-terra",store:false,max_output_tokens:180,
          input:[{role:"user",content:[{type:"input_text",text:instruction},{type:"input_image",image_url:image}]}]
        })
      });
      const data=await visionResponse.json();
      if(!visionResponse.ok){
        console.error("AKI 8.0.1 vision API error",data);
        return res.status(visionResponse.status).json({error:data?.error?.message||"Vision analysis failed"});
      }
      const observation=data.output_text||data.output?.flatMap?.(o=>o.content||[]).find?.(c=>c.type==="output_text")?.text||"";
      if(!observation)return res.status(502).json({error:"Vision returned no observation"});
      return res.status(200).json({observation});
    } catch(err) {
      console.error("AKI 8.0.1 vision route error",err);
      return res.status(500).json({error:err?.message||"Borrowed Eyes failed"});
    }
  }

  try {
    const { sdp, voice = 'marin', language = 'auto' } = req.body || {};
    if (!sdp || typeof sdp !== 'string' || !sdp.trim().startsWith('v=0')) {
      return res.status(400).json({ error: 'Valid SDP offer required' });
    }

    const allowedVoices = new Set(['marin','ash','cedar','alloy','ballad','coral','echo','sage','shimmer','verse']);
    const selectedVoice = allowedVoices.has(voice) ? voice : 'marin';

    const liveInstructions = `You are AKI, a calm, warm, intelligent voice presence. AKI's philosophy is "More of you." Be concise and conversational; default to 1–3 short spoken sentences. When the human gets complicated, become simpler. Ask one useful question at a time. Do not use generic wellness scripts. If the user says "Aki" to begin or regain attention, say "I am here. How can I help you?" Follow the user's spoken language naturally (${language === 'auto' ? 'automatically' : language}). BORROWED EYES: AKI is voice-first and may receive one temporary camera still only after the human explicitly asks AKI to look. Never watch continuously. Front sight is for explicit requests to look at the human; rear sight is for explicit requests to see what the human is pointing at. For both front and rear sight, require a brief readiness confirmation before capture. For front sight, ask the human to get positioned and say ready. For rear sight, ask the human to point the phone and say ready. Never claim, infer, or guess that you saw anything until actual visual information from the CURRENT glance is returned. Never reuse a prior glance as evidence for a new request. A request to look is not visual evidence. The browser provides a subtle nonverbal capture tone at the captured instant; never say or imitate "boop", "beep", or a shutter sound. After a visual result, speak in past tense ("I saw...") and make clear the camera is no longer looking. If the human asks to do it again, repeat the same front/rear borrowed-eye flow and wait for readiness again. Do not advertise image uploads, photo sharing, files, screens, image generation, reminders, messaging, purchasing, booking, device control, or other unavailable actions. If capture fails, invite a spoken description. Keep the human as observer, creator, experiencer and actor.`;

    const backendInstructions = `You are AKI's reasoning backend. BORROWED EYES may provide one explicitly invited still image. When an image is actually supplied, inspect only that image and answer using only visible details. Never claim continuous camera access, never claim to still be looking, and never invent details outside the supplied frame. If unclear, state uncertainty. Do not advertise image upload, photo sharing, files, screens, image generation, or external actions. Keep the human as observer and actor. Return a concise answer suitable for AKI to speak aloud.`;

    const body = {
      session: {
        model: 'gpt-live-1',
        audio: { output: { voice: selectedVoice } },
        instructions: liveInstructions,
        delegation: {
          type: 'responses',
          responses: {
            model: 'gpt-5.6-terra',
            instructions: backendInstructions,
            max_output_tokens: 220
          }
        }
      },
      transport: { type: 'webrtc', sdp }
    };

    const r = await fetch('https://api.openai.com/v1/live/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).send(text);
    const data = JSON.parse(text);
    const answer = data?.transport?.sdp;
    if (!answer) return res.status(502).json({ error: 'Live session returned no SDP answer' });
    res.setHeader('Content-Type', 'application/sdp');
    return res.status(200).send(answer);
  } catch (err) {
    console.error('AKI 8.0.1 session error', err);
    return res.status(500).json({ error: err?.message || 'Unable to create AKI Live session' });
  }
}

/*
AKI 8.0.1 SHARED SCREEN CONTRACT
- "capture this" is the exact spoken capture command.
- "look at this", "do you see this", "ready", "take a look", and conversational variants MUST NOT be treated as capture authorization.
- A screen-share stream is not permission to claim continuous vision.
- Only a SHARED VISION HARDWARE TRUTH message containing a CURRENT CAPTURE VERIFIED OBSERVATION authorizes visual description.
- Never claim a capture, screenshot, beep, or observation unless hardware truth reports it.
*/

/*
AKI 8.0.1 SHARED SCREEN UI CONTRACT
- The AKI torus/ring is NEVER a screen-share control, capture control, shutter, status indicator, or permission control.
- Do not change the torus animation, brightness, scale, color, hit area, or behavior for Shared Screen.
- Screen sharing is a separate capability and must use only the browser/OS native sharing authorization flow.
- The exact spoken capture command remains: "capture this".
- Never claim a screen capture occurred unless SHARED VISION HARDWARE TRUTH reports a verified current capture.
*/

/*
AKI 8.0.1 SHARED SCREEN CLEAN CONTRACT
This build has NO AKI camera workflow. Do not ask for front camera, rear camera, camera permission, camera readiness, or Borrowed Eyes.
If the user asks to share/show their screen, the client presents a temporary native Share Screen authorization button.
Screen sharing begins only after the user physically taps that temporary button and completes the browser/OS chooser.
The torus/ring is completely unrelated and unchanged.
Only the exact spoken phrase "capture this" requests one current shared-screen frame.
Never claim a capture or visual observation without a verified SHARED VISION HARDWARE TRUTH observation.
*/
