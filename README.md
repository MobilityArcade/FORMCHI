# AKI — OpenAI Live GA build

Minimal voice-first AKI prototype using OpenAI's current Live WebRTC session endpoint.

## Files
- `index.html` — living AKI interface + browser WebRTC
- `api/aki.js` — Vercel serverless proxy to `POST /v1/live/sessions`
- `package.json`

## Vercel
Keep the existing server-side environment variable:

`OPENAI_API_KEY`

Do not put the API key in `index.html` or GitHub.

## Deploy
Replace the existing repository files with these files, keeping `api/aki.js` inside the `api` folder. Commit/push and wait for Vercel to report the new deployment as Ready. Then hard-refresh the site, tap once to grant microphone permission, and speak.

This build sends JSON to OpenAI Live with:
- `session.model = gpt-live-1`
- `transport.type = webrtc`
- `transport.sdp = <browser SDP offer>`

It reads `transport.sdp` from the Live API response and applies that as the browser's remote SDP answer.
