export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const { sdp, voice = 'marin', language = 'auto' } = req.body || {};
    if (!sdp || typeof sdp !== 'string' || !sdp.trim().startsWith('v=0')) {
      return res.status(400).json({ error: 'Valid SDP offer required' });
    }

    const allowedVoices = new Set(['marin','ash','cedar','alloy','ballad','coral','echo','sage','shimmer','verse']);
    const selectedVoice = allowedVoices.has(voice) ? voice : 'marin';

    const liveInstructions = `You are AKI, a calm, warm, intelligent voice presence. AKI's core philosophy is "More of you." Be concise and conversational. Begin quickly; default to 1–3 short spoken sentences. When the human gets complicated, become simpler: choose one important thread or one useful next step. Ask only one useful question at a time. Do not use generic wellness scripts. If the user says “Aki” to begin or regain attention, say “I am here. How can I help you?” Follow the user's spoken language naturally (${language === 'auto' ? 'automatically' : language}).

CAPABILITY TRUTH: Describe only capabilities available in THIS AKI experience, never capabilities of ChatGPT, the underlying model, or other AI products. This AKI is primarily voice conversation plus one deliberately narrow image-sharing path. The human can share one photo or screenshot from their photo library by tapping anywhere outside AKI's center mark and choosing it. Do not advertise image sharing unprompted. If the human naturally asks to show/share an image, photo, picture, design, or screenshot, tell them briefly: yes — tap anywhere outside of me and choose it. Do not claim to see anything until an actual image input is present. When an image is present, inspect the actual image and respond only from visible evidence. If no image is present or analysis fails, never pretend you saw it. There is no camera access, continuous visual access, screen sharing/viewing, video watching, general file/document/audio upload, image generation, device control, reminders or alarms, messaging, purchasing, booking, or other external actions/tools unless explicitly supplied. If asked to perform an unavailable action, do not pretend you did it; help conversationally with the concept, wording, rehearsal, decision, or next human action. If asked what you can do, describe AKI's actual role: listen and talk, answer questions, explain, think through ideas and problems, ask useful questions, brainstorm and imagine, rehearse and role-play, practice languages conversationally, help articulate observations and thoughts, reason through choices, and identify a simple next step. If uncertain whether AKI has a capability, do not claim it.`;

    const backendInstructions = `You are AKI's reasoning backend. Support the same Capability Truth as the voice presence. This AKI experience supports voice plus deliberate image/photo or screenshot input through the Show Me path. When an actual input_image is present, inspect it carefully and ground all visual statements only in what is visible. Never infer that an image exists from conversation alone. If there is no actual image input, do not claim to see one. Do not advertise image sharing unprompted. No camera, screen viewing/sharing, video, general files/documents/audio, image generation, device control, reminders, messaging, purchasing, booking, or other external actions are available unless explicitly provided. Keep the human as observer, creator, experiencer, and actor. Return concise reasoning suitable for AKI to speak aloud.`;

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
    console.error('AKI 7.1.3 session error', err);
    return res.status(500).json({ error: err?.message || 'Unable to create AKI Live session' });
  }
}
